import "server-only";

import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";

import { isActiveMember } from "../platform/auth/member-status.ts";
import { user } from "../platform/database/auth-schema.ts";
import type { Database } from "../platform/database/client.ts";
import { isDemoMode } from "../platform/demo/mode.ts";
import type { Environment } from "../platform/environment.ts";
import { readResendConfig } from "../platform/email/resend.ts";
import { emailOutbox } from "../platform/email/schema.ts";
import { readUsageMonth, readMonthlyCreditUsage } from "../platform/village/credit-ledger.ts";
import { CREDIT_CALL_KINDS, ESTIMATED_CREDITS } from "../platform/village/contract.ts";
import { memberDailyUsage } from "../platform/village/schema.ts";
import { readDailyLookupLimit, readVillageKeys } from "../platform/village/settings.ts";
import { asksManifest } from "../modules/asks/manifest.ts";
import { INTRO_OUTCOMES, INTRO_STATES } from "../modules/intros/contract.ts";
import { introsManifest } from "../modules/intros/manifest.ts";
import { memberNetwork, memberProfile } from "../modules/members/schema.ts";
import { INVITE_FILTERS } from "../modules/members/contract-invites.ts";
import { readInvites } from "../modules/members/service-invites.ts";
import { networkManifest } from "../modules/network/manifest.ts";
import { readIntroLog, type IntroLogRow } from "../modules/admin/reads-intro-log.ts";
import { readAsksFigures } from "./admin-asks.ts";
import { readEnabledIds } from "./enabled-modules.ts";

// The console's Home (Founderhall's /admin): every intro counted since launch, the members, the latest of the intro
// log, and the network, lookups, asks and mail at a glance. Counts only, except the intro log rows, which name who
// asked whom (admins see names; notes stay private).

const LATEST_INTRO_ROWS = 6;
const WAITING_INVITE_ROWS = 5;
const RECENT_SENDS = 50;

// Founderhall's ledger numbers, from the intro log. Withdrawn asks count nowhere (the asker took them back).
export type IntroLedger = {
  asked: number;
  connectorYes: number;
  made: number;
  declinedByConnector: number;
  declinedByTarget: number;
  declined: number;
  openWithConnector: number;
  openWithTarget: number;
  open: number;
  answered: number;
  helpful: number;
};

const CONNECTOR_SAID_YES: readonly string[] = [INTRO_STATES.accepted, INTRO_STATES.askingTarget, INTRO_STATES.targetAgreed, INTRO_STATES.targetDeclined, INTRO_STATES.completed];

export function countIntroLedger(rows: readonly IntroLogRow[]): IntroLedger {
  const counted = rows.filter(({ state }) => state !== INTRO_STATES.withdrawn);
  const by = (test: (row: IntroLogRow) => boolean) => counted.filter(test).length;
  const declinedByConnector = by(({ stateWord }) => stateWord === "declined by connector" || stateWord === "no answer from connector");
  const declinedByTarget = by(({ stateWord }) => stateWord === "declined by target" || stateWord === "no answer from target");
  const openWithConnector = by(({ stateWord }) => stateWord === "with connector");
  const openWithTarget = by(({ stateWord }) => stateWord === "with target");
  return {
    asked: counted.length,
    connectorYes: by(({ state, stateWord }) => CONNECTOR_SAID_YES.includes(state) || stateWord === "no answer from target"),
    made: by(({ state }) => state === INTRO_STATES.completed),
    declinedByConnector,
    declinedByTarget,
    declined: declinedByConnector + declinedByTarget,
    openWithConnector,
    openWithTarget,
    open: openWithConnector + openWithTarget,
    answered: by(({ outcome }) => outcome !== null),
    helpful: by(({ outcome }) => outcome === INTRO_OUTCOMES.helped),
  };
}

async function readMemberCounts(database: Database, now: Date) {
  const [[joined], [withProfile], invites] = await Promise.all([
    database.select({ value: count() }).from(user).where(isActiveMember(now)),
    database
      .select({ value: count() })
      .from(memberProfile)
      .innerJoin(user, eq(user.id, memberProfile.userId))
      .where(and(isActiveMember(now), isNotNull(memberProfile.onboardingCompletedAt))),
    readInvites(database, 1, INVITE_FILTERS.pending),
  ]);
  return {
    joined: joined?.value ?? 0,
    withProfile: withProfile?.value ?? 0,
    invited: invites.counts.pending,
    waiting: invites.invites.slice(0, WAITING_INVITE_ROWS).map(({ id, email }) => ({ id, email })),
  };
}

// Members who connected their network through Village: sharing (in the group), connected but not sharing yet
// (no consent to be asked), and still syncing (agreed, not in the group yet).
async function readNetworkCounts(database: Database, now: Date) {
  const [row] = await database
    .select({
      connected: sql<number>`count(*) filter (where ${memberNetwork.villageLinkedAt} is not null)`.mapWith(Number),
      sharing: sql<number>`count(*) filter (where ${memberNetwork.villageLinkedAt} is not null and ${memberNetwork.groupJoinedAt} is not null)`.mapWith(Number),
      noAsks: sql<number>`count(*) filter (where ${memberNetwork.villageLinkedAt} is not null and ${memberNetwork.sharingConsentedAt} is null)`.mapWith(Number),
      syncing: sql<number>`count(*) filter (where ${memberNetwork.villageLinkedAt} is not null and ${memberNetwork.sharingConsentedAt} is not null and ${memberNetwork.groupJoinedAt} is null)`.mapWith(Number),
    })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(isActiveMember(now));
  return { connected: row?.connected ?? 0, sharing: row?.sharing ?? 0, noAsks: row?.noAsks ?? 0, syncing: row?.syncing ?? 0 };
}

// This month's Village use: credits against the cap, and the lookups behind them.
async function readLookups(database: Database, environment: Environment, now: Date) {
  const monthStart = `${readUsageMonth(now)}-01`;
  const [usage, dailyLimit, keys, [calls]] = await Promise.all([
    readMonthlyCreditUsage(database, now),
    readDailyLookupLimit(database),
    readVillageKeys(database, environment),
    database
      .select({
        calls: sql<number>`coalesce(sum(${memberDailyUsage.callCount}), 0)`.mapWith(Number),
        searches: sql<number>`coalesce(sum(${memberDailyUsage.searchCount}), 0)`.mapWith(Number),
      })
      .from(memberDailyUsage)
      .where(gte(memberDailyUsage.usageDate, monthStart)),
  ]);
  const searches = calls?.searches ?? 0;
  const day = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    isConfigured: keys !== null || isDemoMode(environment),
    used: usage.credits,
    cap: usage.cap,
    usedPercent: usage.usedPercent,
    pace: usage.credits ? Math.round((usage.credits / day) * daysInMonth) : 0,
    search: searches,
    paths: Math.max(0, (calls?.calls ?? 0) - searches),
    fillIn: Math.round(usage.fillInCredits / ESTIMATED_CREDITS[CREDIT_CALL_KINDS.fillIn]),
    dailyLimit,
  };
}

// The mail checklist: the sending service, the sending address's domain, and the last sends.
async function readMail(database: Database, environment: Environment) {
  const config = readResendConfig(environment);
  const recent = await database
    .select({ status: emailOutbox.status })
    .from(emailOutbox)
    .where(isNotNull(emailOutbox.finishedAt))
    .orderBy(desc(emailOutbox.finishedAt))
    .limit(RECENT_SENDS);
  const fromAddress = config?.fromAddress ?? null;
  const address = fromAddress?.match(/<([^>]+)>/)?.[1] ?? fromAddress;
  const domain = address?.split("@")[1] ?? null;
  return {
    isSet: config !== null,
    isDemo: isDemoMode(environment),
    address,
    domain,
    sent: recent.filter(({ status }) => status === "sent" || status === "skipped").length,
    failed: recent.filter(({ status }) => status === "failed").length,
  };
}

export async function readConsoleHome(database: Database, environment: Environment, now = new Date()) {
  const enabledIds = await readEnabledIds(database);
  const isIntrosOn = enabledIds.has(introsManifest.id);
  const isNetworkOn = enabledIds.has(networkManifest.id);
  const isAsksOn = enabledIds.has(asksManifest.id);
  const [log, members, network, lookups, asks, mail] = await Promise.all([
    isIntrosOn ? readIntroLog(database) : [],
    readMemberCounts(database, now),
    isNetworkOn ? readNetworkCounts(database, now) : null,
    isNetworkOn ? readLookups(database, environment, now) : null,
    // The same figures as Asks & digest, from the one read, so the two pages agree.
    isAsksOn ? readAsksFigures(database, now) : null,
    readMail(database, environment),
  ]);
  return {
    isIntrosOn,
    ledger: countIntroLedger(log),
    latest: log.slice(0, LATEST_INTRO_ROWS),
    members,
    network,
    lookups,
    asks,
    mail,
  };
}

export type ConsoleHome = Awaited<ReturnType<typeof readConsoleHome>>;
