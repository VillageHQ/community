import "server-only";

import { and, count, desc, eq, gte, isNotNull, isNull, max, ne, sql, sum } from "drizzle-orm";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { CREDIT_CALL_KINDS, type CreditCallKind } from "../../platform/village/contract.ts";
import { villageCreditCall } from "../../platform/village/schema.ts";
import { memberNetwork, memberPrivacy } from "../members/schema.ts";
import { readInviteCounts } from "../members/service-invites.ts";
import { memberConnectNudge } from "./schema.ts";
import { isInNudgeAudience, NUDGE_AUDIENCES, NUDGE_INTERVAL_DAYS, type NudgeAudience } from "./service-nudge.ts";

const LATEST_LOOKUPS_SHOWN = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

// The words for each paid call in "Latest lookups".
export const LOOKUP_LABELS: Record<CreditCallKind, string> = {
  [CREDIT_CALL_KINDS.search]: "People search",
  [CREDIT_CALL_KINDS.path]: "Paths to one person",
  [CREDIT_CALL_KINDS.pathsBulk]: "Paths for a page of results",
  [CREDIT_CALL_KINDS.fillIn]: "Profile fill-in",
};

function readMonthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// This month's lookups by kind, and the latest ones, from the per-call ledger.
export async function readLookupsThisMonth(database: Database, now = new Date()) {
  const since = readMonthStart(now);
  const [byKind, latest] = await Promise.all([
    database
      .select({ kind: villageCreditCall.kind, credits: sum(villageCreditCall.credits) })
      .from(villageCreditCall)
      .where(gte(villageCreditCall.calledAt, since))
      .groupBy(villageCreditCall.kind),
    database
      .select({ id: villageCreditCall.id, kind: villageCreditCall.kind, credits: villageCreditCall.credits, calledAt: villageCreditCall.calledAt, memberName: user.name })
      .from(villageCreditCall)
      .leftJoin(user, eq(user.id, villageCreditCall.userId))
      .orderBy(desc(villageCreditCall.calledAt))
      .limit(LATEST_LOOKUPS_SHOWN),
  ]);
  const creditsOf = (kind: CreditCallKind) => Number(byKind.find((row) => row.kind === kind)?.credits ?? 0);
  return {
    search: creditsOf(CREDIT_CALL_KINDS.search),
    paths: creditsOf(CREDIT_CALL_KINDS.path),
    fillIn: creditsOf(CREDIT_CALL_KINDS.fillIn),
    latest: latest.map((row) => ({ ...row, label: LOOKUP_LABELS[row.kind as CreditCallKind] ?? row.kind })),
  };
}

// "Members who connected their network": connected = in the community's Village group. Of those, who takes intro asks.
export async function readNetworkReach(database: Database, now = new Date()) {
  const [[row], invites] = await Promise.all([
    database
      .select({
        joined: count(),
        connected: sql<number>`count(*) filter (where ${isNotNull(memberNetwork.groupJoinedAt)})`.mapWith(Number),
        noAsks: sql<number>`count(*) filter (where ${and(isNotNull(memberNetwork.groupJoinedAt), eq(memberPrivacy.acceptsIntroAsks, false))})`.mapWith(Number),
        syncing: sql<number>`count(*) filter (where ${and(isNull(memberNetwork.groupJoinedAt), isNotNull(memberNetwork.sharingConsentedAt))})`.mapWith(Number),
      })
      .from(user)
      .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
      .leftJoin(memberPrivacy, eq(memberPrivacy.userId, user.id))
      .where(isActiveMember(now)),
    readInviteCounts(database, now),
  ]);
  const joined = row?.joined ?? 0;
  const connected = row?.connected ?? 0;
  const noAsks = row?.noAsks ?? 0;
  const syncing = row?.syncing ?? 0;
  return {
    joined,
    connected,
    sharing: connected - noAsks,
    noAsks,
    syncing,
    notConnected: Math.max(0, joined - connected - syncing),
    invited: invites.pending,
    percent: joined ? Math.round((connected * 100) / joined) : 0,
  };
}

// Each audience's nudge: how many members it would go to now, and when the last one went out (each member is
// reminded at most once every 30 days, so a nudge "locks" until then for the members it reached).
export async function readNudgeState(database: Database, adminId: string, audience: NudgeAudience, now = new Date()) {
  const cutoff = new Date(now.getTime() - NUDGE_INTERVAL_DAYS * DAY_MS);
  const [row] = await database
    .select({
      audienceCount: count(),
      dueCount: sql<number>`count(*) filter (where ${memberConnectNudge.lastSentAt} is null or ${memberConnectNudge.lastSentAt} < ${cutoff})`.mapWith(Number),
      lastSentAt: max(memberConnectNudge.lastSentAt),
    })
    .from(user)
    .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
    .leftJoin(memberPrivacy, eq(memberPrivacy.userId, user.id))
    .leftJoin(memberConnectNudge, eq(memberConnectNudge.userId, user.id))
    .where(and(isActiveMember(now), isInNudgeAudience(audience), ne(user.id, adminId)));
  const lastSentAt = row?.lastSentAt ?? null;
  const isRecent = lastSentAt !== null && lastSentAt >= cutoff;
  return {
    audience,
    audienceCount: row?.audienceCount ?? 0,
    dueCount: row?.dueCount ?? 0,
    lastSentAt: isRecent ? lastSentAt : null,
    nextAllowedAt: isRecent ? new Date(lastSentAt.getTime() + NUDGE_INTERVAL_DAYS * DAY_MS) : null,
  };
}

export async function readNudgeStates(database: Database, adminId: string, now = new Date()) {
  const [unconnected, noAsks] = await Promise.all([
    readNudgeState(database, adminId, NUDGE_AUDIENCES.unconnected, now),
    readNudgeState(database, adminId, NUDGE_AUDIENCES.noAsks, now),
  ]);
  return { unconnected, noAsks };
}
