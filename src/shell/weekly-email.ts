import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq, gt, lte, notExists, notInArray } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { readBranding, type Branding } from "@/platform/branding/branding";
import { isActiveMember } from "@/platform/auth/member-status";
import { user } from "@/platform/database/auth-schema";
import type { Database } from "@/platform/database/client";
import { EMAIL_KINDS, EMAIL_TOPICS } from "@/platform/email/kinds";
import { isEmailWanted, queueEmail } from "@/platform/email/outbox";
import { sendQueuedEmailNow } from "@/platform/email/outbox-sender";
import { readResendConfig } from "@/platform/email/resend";
import { emailOptOut } from "@/platform/email/schema";
import type { Environment } from "@/platform/environment";
import { resolveAppUrl } from "@/platform/http/app-url";
import { ROUTES } from "@/platform/http/routes";
import type { SessionMember } from "@/platform/http/request-context";
import { logError } from "@/platform/observability/route-logging";
import { claimWeeklyEmail, recordOutboxId, WEEKLY_EMAIL_STATUSES } from "@/platform/weekly-email/ledger";
import { readCurrentWeek, type WeeklyMoment } from "@/platform/weekly-email/schedule";
import { readWeeklySchedule } from "@/platform/weekly-email/schedule-store";
import { weeklyEmail, type WeeklyEmailItem } from "@/platform/weekly-email/schema";
import { createItemToken, createReplyAddress, readReplyDomain } from "@/platform/weekly-email/tokens";

import { readEnabledIds } from "./enabled-modules";
import { needsMemberThisWeek, numberWeeklyItems, readTodayItems, type TodayItems } from "./today";
import { ITEM_ACTIONS, renderWeeklyEmail, type ItemLinks } from "./weekly-email-compose";

const MEMBERS_PER_BATCH = 50;
const DAY_MS = 24 * 60 * 60_000;
// Moving the day, or a late catch-up, makes a week whose moment is close to the last email. An
// email sent less than this before the week's moment counts for that week too, so nobody gets two
// in a few days, and the next week lands back on the set day.
const MINIMUM_GAP_MS = 6 * DAY_MS;
const TEST_WEEK_PREFIX = "test:";

type Recipient = { id: string; name: string; email: string };

export type WeeklyRunSummary = { weekKey: string | null; queued: number; empty: number; notWanted: number; failed: number };

function itemActions(item: WeeklyEmailItem) {
  return item.kind === "intro" ? ITEM_ACTIONS.intro : ITEM_ACTIONS.ask;
}

async function buildItemLinks(database: Database, environment: Environment, weeklyEmailId: string, numbered: readonly WeeklyEmailItem[]): Promise<ItemLinks> {
  const appUrl = resolveAppUrl(environment);
  const links = new Map<number, Map<string, string>>();
  for (const item of numbered) {
    const actions = new Map<string, string>();
    for (const action of itemActions(item)) {
      const token = await createItemToken(database, environment, { weeklyEmailId, itemNumber: item.number, action });
      actions.set(action, `${appUrl}${ROUTES.weeklyAnswer}?token=${encodeURIComponent(token)}`);
    }
    links.set(item.number, actions);
  }
  return links;
}

// A preview's buttons go nowhere that acts: they open the app.
function placeholderLinks(environment: Environment, numbered: readonly WeeklyEmailItem[]): ItemLinks {
  const appUrl = resolveAppUrl(environment);
  return new Map(numbered.map((item) => [item.number, new Map(itemActions(item).map((action) => [action, appUrl]))]));
}

type ComposeInput = { recipient: Recipient; items: TodayItems; numbered: WeeklyEmailItem[]; links: ItemLinks; branding: Branding; canReply: boolean; isTest: boolean };

function compose(environment: Environment, { recipient, items, numbered, links, branding, canReply, isTest }: ComposeInput) {
  return renderWeeklyEmail({
    memberName: recipient.name,
    communityName: branding.name,
    accentColor: branding.accentColor,
    appUrl: resolveAppUrl(environment),
    items,
    numbered,
    links,
    canReply,
    isTest,
  });
}

// Builds and queues one member's email for the week. The row and the outbox email are written in
// one transaction, so a crash leaves either both or neither, and the next run knows which.
async function queueWeeklyEmailFor(database: Database, environment: Environment, recipient: Recipient, week: WeeklyMoment, enabledIds: ReadonlySet<string>, branding: Branding, now: Date) {
  const items = await readTodayItems(database, recipient.id, enabledIds, now);
  const base = { memberId: recipient.id, weekKey: week.weekKey, createdAt: now };
  if (!needsMemberThisWeek(items)) {
    await claimWeeklyEmail(database, { ...base, status: WEEKLY_EMAIL_STATUSES.empty, items: [] });
    return WEEKLY_EMAIL_STATUSES.empty;
  }
  const email = { kind: EMAIL_KINDS.weeklyEmail, to: recipient.email, memberId: recipient.id };
  if (!(await isEmailWanted(database, email))) {
    await claimWeeklyEmail(database, { ...base, status: WEEKLY_EMAIL_STATUSES.notWanted, items: [] });
    return WEEKLY_EMAIL_STATUSES.notWanted;
  }

  const id = randomUUID();
  const numbered = numberWeeklyItems(items);
  const [links, replyTo] = await Promise.all([buildItemLinks(database, environment, id, numbered), createReplyAddress(database, environment, id)]);
  const rendered = compose(environment, { recipient, items, numbered, links, branding, canReply: replyTo !== null, isTest: false });
  await database.transaction(async (transaction) => {
    const claimed = await claimWeeklyEmail(transaction, { ...base, id, status: WEEKLY_EMAIL_STATUSES.queued, items: numbered });
    if (!claimed) return;
    const outboxId = await queueEmail(transaction, environment, { ...email, ...rendered, replyTo, dedupeKey: `weekly:${id}` });
    await recordOutboxId(transaction, id, outboxId);
  });
  return WEEKLY_EMAIL_STATUSES.queued;
}

function readDueMembers(database: Database, week: WeeklyMoment, now: Date, skippedIds: readonly string[]) {
  // `now` only decides who is active; the gap is measured from the week's own moment.
  const thisWeek = new QueryBuilder()
    .select({ id: weeklyEmail.id })
    .from(weeklyEmail)
    .where(and(eq(weeklyEmail.memberId, user.id), eq(weeklyEmail.weekKey, week.weekKey)));
  const recentlySent = new QueryBuilder()
    .select({ id: weeklyEmail.id })
    .from(weeklyEmail)
    .where(
      and(
        eq(weeklyEmail.memberId, user.id),
        eq(weeklyEmail.status, WEEKLY_EMAIL_STATUSES.queued),
        gt(weeklyEmail.createdAt, new Date(week.at.getTime() - MINIMUM_GAP_MS)),
      ),
    );
  const switchedOff = new QueryBuilder()
    .select({ memberId: emailOptOut.memberId })
    .from(emailOptOut)
    .where(and(eq(emailOptOut.memberId, user.id), eq(emailOptOut.topic, EMAIL_TOPICS.weekly)));
  return database
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(
      and(
        isActiveMember(now),
        lte(user.createdAt, week.at),
        notExists(thisWeek),
        notExists(recentlySent),
        notExists(switchedOff),
        skippedIds.length > 0 ? notInArray(user.id, [...skippedIds]) : undefined,
      ),
    )
    .orderBy(asc(user.id))
    .limit(MEMBERS_PER_BATCH);
}

export type WeeklyRunOptions = { now?: Date; maximumMembers?: number };

// The timed job. Each member is done on their own, and done members are recorded, so a run that
// stops part way (a restart, a deploy, the lease running out) carries on at the next tick.
export async function runWeeklyEmails(database: Database, environment: Environment, { now = new Date(), maximumMembers = Number.POSITIVE_INFINITY }: WeeklyRunOptions = {}) {
  const summary: WeeklyRunSummary = { weekKey: null, queued: 0, empty: 0, notWanted: 0, failed: 0 };
  if (!readResendConfig(environment)) return summary;
  const week = readCurrentWeek(now, await readWeeklySchedule(database));
  if (!week) return summary;
  summary.weekKey = week.weekKey;

  const [enabledIds, branding] = await Promise.all([readEnabledIds(database), readBranding(database)]);
  const failedIds: string[] = [];
  let handled = 0;
  while (handled < maximumMembers) {
    const members = await readDueMembers(database, week, now, failedIds);
    if (members.length === 0) break;
    for (const member of members) {
      if (handled >= maximumMembers) break;
      handled += 1;
      try {
        const status = await queueWeeklyEmailFor(database, environment, member, week, enabledIds, branding, now);
        if (status === WEEKLY_EMAIL_STATUSES.queued) summary.queued += 1;
        else if (status === WEEKLY_EMAIL_STATUSES.empty) summary.empty += 1;
        else summary.notWanted += 1;
      } catch (error) {
        logError("weekly-email-member", error);
        failedIds.push(member.id);
        summary.failed += 1;
      }
    }
  }
  return summary;
}

export const WEEKLY_PREVIEW_SOURCES = { mine: "mine", sample: "sample" } as const;

export type WeeklyPreviewSource = (typeof WEEKLY_PREVIEW_SOURCES)[keyof typeof WEEKLY_PREVIEW_SOURCES];

const SAMPLE_MEMBER = { id: "sample-member", name: "Sample Member", email: "sample@example.com" };

// A made-up member's week. None of it comes from the database, so a preview can't show anyone's real items.
export function buildSampleItems(now = new Date()): TodayItems {
  const at = now.toISOString();
  const person = (id: string, name: string) => ({ id, name, headline: null, linkedinSlug: null, avatarUrl: null, isAvailable: true });
  const intro = {
    id: "00000000-0000-4000-8000-000000000002",
    state: "requested" as const,
    viewerRole: "introducer" as const,
    note: "We're hiring our first designer and Jo ran design at a company our size.",
    reason: "",
    declineReason: null,
    declineKind: null,
    hasUpdate: false,
    createdAt: at,
    acceptedAt: null,
    askedTargetAt: null,
    targetAgreedAt: null,
    outcome: null,
    isOutcomeDue: false,
    closedAt: null,
    expiresAt: at,
    target: { name: "Jo Rivera", headline: "Head of Design", linkedinSlug: "jo-rivera-example" },
    requester: person("sample-requester", "Alex Morgan"),
    introducer: person(SAMPLE_MEMBER.id, SAMPLE_MEMBER.name),
  };
  return {
    helpableAsks: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        title: "Who knows a good fractional CFO for a seed-stage startup?",
        author: { id: "sample-asker", name: "Priya Shah" },
        listedAt: at,
        matchedWords: ["finance"],
      },
    ],
    introsToAnswer: [intro],
    introsToFinish: [],
    profileLines: [],
    ownAsks: [
      {
        id: "00000000-0000-4000-8000-000000000003",
        title: "Looking for beta users in logistics",
        detail: null,
        category: "customer",
        listedAt: at,
        expiresAt: at,
        state: "open",
        outcome: null,
        canRenew: false,
        offers: [],
      },
    ],
    newMembers: [],
    newMemberCount: 2,
  };
}

// The admin's own week, or the made-up member's. Never another member's.
async function readAdminRecipient(database: Database, admin: SessionMember): Promise<Recipient> {
  const [row] = await database.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, admin.id));
  return { id: admin.id, name: row?.name ?? "", email: row?.email ?? admin.email };
}

export async function previewWeeklyEmail(database: Database, environment: Environment, admin: SessionMember, source: WeeklyPreviewSource) {
  const [branding, enabledIds] = await Promise.all([readBranding(database), readEnabledIds(database)]);
  const isSample = source === WEEKLY_PREVIEW_SOURCES.sample;
  const items = isSample ? buildSampleItems() : await readTodayItems(database, admin.id, enabledIds);
  const numbered = numberWeeklyItems(items);
  const recipient = isSample ? SAMPLE_MEMBER : await readAdminRecipient(database, admin);
  const rendered = compose(environment, { recipient, items, numbered, links: placeholderLinks(environment, numbered), branding, canReply: readReplyDomain(environment) !== null, isTest: false });
  return { ...rendered, isEmpty: !needsMemberThisWeek(items), recipientName: recipient.name };
}

export const TEST_SEND_OUTCOMES = { sent: "sent", queued: "queued", emailOff: "email_off", switchedOff: "switched_off" } as const;

// Sends the admin their own week now, with working links and reply codes, to their own address only.
export async function sendWeeklyTest(database: Database, environment: Environment, admin: SessionMember) {
  if (!readResendConfig(environment)) return TEST_SEND_OUTCOMES.emailOff;
  const recipient = await readAdminRecipient(database, admin);
  const email = { kind: EMAIL_KINDS.weeklyEmail, to: recipient.email, memberId: recipient.id };
  if (!(await isEmailWanted(database, email))) return TEST_SEND_OUTCOMES.switchedOff;

  const [branding, enabledIds] = await Promise.all([readBranding(database), readEnabledIds(database)]);
  const items = await readTodayItems(database, recipient.id, enabledIds);
  const numbered = numberWeeklyItems(items);
  const id = randomUUID();
  const [links, replyTo] = await Promise.all([buildItemLinks(database, environment, id, numbered), createReplyAddress(database, environment, id)]);
  const rendered = compose(environment, { recipient, items, numbered, links, branding, canReply: replyTo !== null, isTest: true });
  const outboxId = await database.transaction(async (transaction) => {
    await claimWeeklyEmail(transaction, { id, memberId: recipient.id, weekKey: `${TEST_WEEK_PREFIX}${id}`, status: WEEKLY_EMAIL_STATUSES.test, items: numbered });
    const queued = await queueEmail(transaction, environment, { ...email, ...rendered, replyTo });
    await recordOutboxId(transaction, id, queued);
    return queued;
  });
  return (await sendQueuedEmailNow(database, environment, outboxId)) ? TEST_SEND_OUTCOMES.sent : TEST_SEND_OUTCOMES.queued;
}
