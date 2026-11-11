import "server-only";

import { and, count, countDistinct, desc, eq, gte, inArray, isNotNull, isNull, max, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { isActiveMember } from "../platform/auth/member-status.ts";
import type { Database } from "../platform/database/client.ts";
import { user } from "../platform/database/auth-schema.ts";
import { REPORT_TARGETS } from "../modules/admin/contract.ts";
import { contentReport } from "../modules/admin/schema.ts";
import { ASK_KINDS, ASK_LIMITS, ASK_OUTCOMES, ASK_STATES } from "../modules/asks/contract.ts";
import { readOldestUnansweredAsks } from "../modules/asks/reads-admin.ts";
import { readWeeklyAllowance } from "../modules/asks/reads.ts";
import { readAskState } from "../modules/asks/rules-state.ts";
import { ask, askAnswer, askHelper, askOffer } from "../modules/asks/schema.ts";
import { INTRO_STATES } from "../modules/intros/contract.ts";
import { introRequest } from "../modules/intros/schema.ts";
import { readNextSend, type WeeklySchedule } from "../platform/weekly-email/schedule.ts";
import { readWeeklySchedule } from "../platform/weekly-email/schedule-store.ts";
import { WEEKLY_EMAIL_STATUSES } from "../platform/weekly-email/ledger.ts";
import { weeklyEmail, weeklyEmailAction } from "../platform/weekly-email/schema.ts";
import { describeNextDigest, readWeeklyEmailEnabled } from "./weekly-email-settings.ts";

const REPORTED_SHOWN = 10;
const answerAuthor = alias(user, "admin_answer_author");
const ROWS_SHOWN = 200;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DIGEST_WINDOW_DAYS = 30;

// Open reports on asks and their answers, one line per reported thing, newest report first. The copy is the one the
// reports queue shows; removing from here resolves every open report on it, as the queue does.
async function readReportedAsks(database: Database) {
  const askTargets = [REPORT_TARGETS.ask, REPORT_TARGETS.askAnswer];
  const rows = await database
    .select({
      targetType: contentReport.targetType,
      targetId: contentReport.targetId,
      reportId: sql<string>`(array_agg(${contentReport.id} order by ${contentReport.createdAt} desc))[1]`,
      body: sql<string>`(array_agg(${contentReport.body} order by ${contentReport.createdAt} desc))[1]`,
      reportCount: count(),
      lastReportedAt: max(contentReport.createdAt),
    })
    .from(contentReport)
    .where(and(isNull(contentReport.resolvedAt), inArray(contentReport.targetType, askTargets)))
    .groupBy(contentReport.targetType, contentReport.targetId)
    .orderBy(desc(max(contentReport.createdAt)))
    .limit(REPORTED_SHOWN);
  return rows.map(({ targetType, reportId, body, reportCount, lastReportedAt }) => ({
    reportId,
    targetType: targetType === REPORT_TARGETS.askAnswer ? REPORT_TARGETS.askAnswer : REPORT_TARGETS.ask,
    body,
    reportCount,
    lastReportedAt: (lastReportedAt ?? new Date()).toISOString(),
  }));
}

export type ReportedAsk = Awaited<ReturnType<typeof readReportedAsks>>[number];

// Founderhall's "Asks & updates" figures (the console home and Asks & digest): every ask since launch, counts only.
// Answered = closed as solved (here or elsewhere); helped = an ask with at least one offer of help.
export type AsksFigures = {
  posted: number;
  open: number;
  answered: number;
  medianHours: number | null;
  withHelpers: number;
  helped: number;
  intros: number;
  introsMade: number;
  updates: number;
};

function median(values: readonly number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[middle] ?? null) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export async function readAsksFigures(database: Database, now = new Date()): Promise<AsksFigures> {
  const firstOffer = database
    .select({ askId: askOffer.askId, at: sql<Date>`min(${askOffer.createdAt})`.as("first_offer_at") })
    .from(askOffer)
    .groupBy(askOffer.askId)
    .as("first_offer");
  const [asks, helpers, updates, intros] = await Promise.all([
    database
      .select({ listedAt: ask.listedAt, closedAt: ask.closedAt, outcome: ask.outcome, createdAt: ask.createdAt, firstOfferAt: firstOffer.at })
      .from(ask)
      .leftJoin(firstOffer, eq(firstOffer.askId, ask.id))
      .where(eq(ask.kind, ASK_KINDS.ask)),
    database
      .select({ asks: countDistinct(askHelper.askId) })
      .from(askHelper)
      .innerJoin(ask, eq(ask.id, askHelper.askId))
      .where(eq(ask.kind, ASK_KINDS.ask)),
    database.select({ updates: count() }).from(ask).where(eq(ask.kind, ASK_KINDS.update)),
    database
      .select({ intros: count(), made: sql<number>`count(*) filter (where ${introRequest.state} = ${INTRO_STATES.completed})`.mapWith(Number) })
      .from(introRequest)
      .where(and(isNotNull(introRequest.askId), eq(introRequest.isWithheld, false))),
  ]);
  const solved: string[] = [ASK_OUTCOMES.solvedHere, ASK_OUTCOMES.solvedElsewhere];
  const hours = asks.flatMap(({ createdAt, firstOfferAt }) => (firstOfferAt ? [(new Date(firstOfferAt).getTime() - createdAt.getTime()) / HOUR_MS] : []));
  return {
    posted: asks.length,
    open: asks.filter((row) => readAskState(row, now) === ASK_STATES.open).length,
    answered: asks.filter(({ outcome }) => outcome !== null && solved.includes(outcome)).length,
    medianHours: median(hours),
    withHelpers: helpers[0]?.asks ?? 0,
    helped: hours.length,
    intros: intros[0]?.intros ?? 0,
    introsMade: intros[0]?.made ?? 0,
    updates: updates[0]?.updates ?? 0,
  };
}

// Founderhall's words for a wait: "under an hour", "22 hours", "3.5 days"; "–" when nobody has helped yet.
export function describeHours(hours: number | null) {
  if (hours === null) return "–";
  if (hours < 1) return "under an hour";
  if (hours < 48) {
    const rounded = Math.round(hours);
    return `${rounded} hour${rounded === 1 ? "" : "s"}`;
  }
  return `${Math.round((hours / 24) * 10) / 10} days`;
}

export const ASK_ROW_STATUSES = { open: "open", answered: "answered", closed: "closed", expired: "expired", update: "update" } as const;

export type AskRowStatus = (typeof ASK_ROW_STATUSES)[keyof typeof ASK_ROW_STATUSES];

export type AdminAskRow = {
  id: string;
  kind: string;
  title: string;
  authorName: string;
  createdAt: string;
  helperCount: number;
  answerCount: number;
  status: AskRowStatus;
  isPinned: boolean;
  canClose: boolean;
};

function readRowStatus(row: { kind: string; listedAt: Date; closedAt: Date | null; outcome: string | null }, now: Date): AskRowStatus {
  if (row.kind === ASK_KINDS.update) return ASK_ROW_STATUSES.update;
  const state = readAskState(row, now);
  if (state === ASK_STATES.open) return ASK_ROW_STATUSES.open;
  if (state === ASK_STATES.expired) return ASK_ROW_STATUSES.expired;
  return row.outcome === ASK_OUTCOMES.noLongerNeeded ? ASK_ROW_STATUSES.closed : ASK_ROW_STATUSES.answered;
}

// Every ask and update, newest first: Founderhall's moderation rows. Names and dates only, never an answer's words.
async function readAskRows(database: Database, now: Date): Promise<AdminAskRow[]> {
  const helperCount = database.select({ askId: askHelper.askId, n: count().as("helper_n") }).from(askHelper).groupBy(askHelper.askId).as("helper_counts");
  // Answers members can see: the author is still an active member, as on the board.
  const answerCount = database
    .select({ askId: askAnswer.askId, n: count().as("answer_n") })
    .from(askAnswer)
    .innerJoin(answerAuthor, eq(answerAuthor.id, askAnswer.authorId))
    .where(isActiveMember(now, answerAuthor))
    .groupBy(askAnswer.askId)
    .as("answer_counts");
  const rows = await database
    .select({
      id: ask.id,
      kind: ask.kind,
      title: ask.title,
      authorName: user.name,
      createdAt: ask.createdAt,
      listedAt: ask.listedAt,
      closedAt: ask.closedAt,
      outcome: ask.outcome,
      pinnedAt: ask.pinnedAt,
      helperCount: helperCount.n,
      answerCount: answerCount.n,
    })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .leftJoin(helperCount, eq(helperCount.askId, ask.id))
    .leftJoin(answerCount, eq(answerCount.askId, ask.id))
    .orderBy(desc(ask.createdAt), desc(ask.id))
    .limit(ROWS_SHOWN);
  return rows.map((row) => {
    const status = readRowStatus(row, now);
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      authorName: row.authorName,
      createdAt: row.createdAt.toISOString(),
      helperCount: Number(row.helperCount ?? 0),
      answerCount: Number(row.answerCount ?? 0),
      status,
      isPinned: row.pinnedAt !== null,
      canClose: row.closedAt === null,
    };
  });
}

// The weekly digest's last 30 days: sent, skipped with nothing to answer, items answered (and how many by reply).
async function readDigestCounts(database: Database, now: Date) {
  const since = new Date(now.getTime() - DIGEST_WINDOW_DAYS * DAY_MS);
  const [[emails], [actions]] = await Promise.all([
    database
      .select({
        sent: sql<number>`count(*) filter (where ${weeklyEmail.status} = ${WEEKLY_EMAIL_STATUSES.queued})`.mapWith(Number),
        empty: sql<number>`count(*) filter (where ${weeklyEmail.status} = ${WEEKLY_EMAIL_STATUSES.empty})`.mapWith(Number),
      })
      .from(weeklyEmail)
      .where(gte(weeklyEmail.createdAt, since)),
    database
      .select({ answered: count(), byReply: sql<number>`count(*) filter (where ${weeklyEmailAction.via} = 'reply')`.mapWith(Number) })
      .from(weeklyEmailAction)
      .where(gte(weeklyEmailAction.createdAt, since)),
  ]);
  return { sent: emails?.sent ?? 0, empty: emails?.empty ?? 0, answered: actions?.answered ?? 0, byReply: actions?.byReply ?? 0 };
}

function readNextLabel(schedule: WeeklySchedule, isEnabled: boolean, now: Date) {
  if (!isEnabled) return null;
  const next = readNextSend(now, schedule);
  return next ? describeNextDigest(next.at, schedule.timeZone) : null;
}

// Everything Asks & digest shows.
export async function readAdminAsks(database: Database, now = new Date()) {
  const [figures, rows, oldest, reported, weeklyAllowance, schedule, isDigestOn, digest] = await Promise.all([
    readAsksFigures(database, now),
    readAskRows(database, now),
    readOldestUnansweredAsks(database, now),
    readReportedAsks(database),
    readWeeklyAllowance(database),
    readWeeklySchedule(database),
    readWeeklyEmailEnabled(database),
    readDigestCounts(database, now),
  ]);
  const pinnedCount = rows.filter(({ isPinned }) => isPinned).length;
  return {
    figures,
    rows,
    oldest,
    reported,
    weeklyAllowance,
    schedule,
    isDigestOn,
    nextDigest: readNextLabel(schedule, isDigestOn, now),
    digest,
    canPin: pinnedCount < ASK_LIMITS.pinnedAsks,
  };
}

export type AdminAsks = Awaited<ReturnType<typeof readAdminAsks>>;
