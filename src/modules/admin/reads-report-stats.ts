import "server-only";

import { aliasedTable, and, eq, gte, inArray, lt, min, sql } from "drizzle-orm";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { readBranding } from "../../platform/branding/branding.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { ASK_KINDS, ASK_LIMITS, ASK_OUTCOMES, type AskCategory } from "../asks/contract.ts";
import { ask, askAnswer, askOffer } from "../asks/schema.ts";
import { INTRO_STATES } from "../intros/contract.ts";
import { readOutcomeDays } from "../intros/reads-outcome-days.ts";
import { expireDueIntros } from "../intros/reads.ts";
import { introRequest } from "../intros/schema.ts";
import { memberProfile } from "../members/schema.ts";
import { readConsolePeriod, type ConsolePeriodParam } from "./console-periods.ts";
import { readReportOptions } from "./reads-partner-report.ts";
import { computeReportStats, readReportTitle, readSummaryLine, type AskStats, type ReportIntroRow, type ReportStats } from "./report-stats.ts";

// The partner report for one period, read once: the page, its CSV and its email all render this object.
// No asker, target or note is read. Connectors are named in Top connectors: every one on the admin's page (the owner's
// decision), only those who turned on "Credit me in reports" in what goes to partners.

type Period = { from: Date | null; to: Date | null };

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const requesterProfile = aliasedTable(memberProfile, "report_requester_profile");
const connector = aliasedTable(user, "report_connector");
const connectorProfile = aliasedTable(memberProfile, "report_connector_profile");

function inPeriod(column: typeof introRequest.createdAt | typeof ask.createdAt, { from, to }: Period) {
  return and(from ? gte(column, from) : undefined, to ? lt(column, to) : undefined);
}

async function readIntroRows(database: Database, period: Period): Promise<ReportIntroRow[]> {
  const rows = await database
    .select({
      state: introRequest.state,
      createdAt: introRequest.createdAt,
      acceptedAt: introRequest.acceptedAt,
      askedTargetAt: introRequest.askedTargetAt,
      targetAgreedAt: introRequest.targetAgreedAt,
      closedAt: introRequest.closedAt,
      outcome: introRequest.outcome,
      outcomeResults: introRequest.outcomeResults,
      connectorKey: introRequest.introducerId,
      connectorName: connector.name,
      connectorCredited: sql<boolean>`coalesce(${connectorProfile.creditInReports} and (${isActiveMember(new Date(), connector)}), false)`,
      sector: requesterProfile.sector,
      cohort: requesterProfile.cohort,
      need: ask.category,
    })
    .from(introRequest)
    .leftJoin(requesterProfile, eq(requesterProfile.userId, introRequest.requesterId))
    .leftJoin(connector, eq(connector.id, introRequest.introducerId))
    .leftJoin(connectorProfile, eq(connectorProfile.userId, introRequest.introducerId))
    .leftJoin(ask, eq(ask.id, introRequest.askId))
    .where(and(eq(introRequest.isWithheld, false), inPeriod(introRequest.createdAt, period)));
  return rows.map(({ need, ...row }) => ({
    ...row,
    need: (need as AskCategory | null) ?? null,
  }));
}

async function readFirstAskAt(database: Database) {
  const [row] = await database.select({ first: min(introRequest.createdAt) }).from(introRequest).where(eq(introRequest.isWithheld, false));
  return row?.first ?? null;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = values.toSorted((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

// Asks & updates for the period: asks posted, answered (solved here), still open, and how fast members offered help.
async function readAskStats(database: Database, period: Period, now: Date): Promise<AskStats> {
  const asks = await database
    .select({ id: ask.id, authorId: ask.authorId, createdAt: ask.createdAt, listedAt: ask.listedAt, closedAt: ask.closedAt, outcome: ask.outcome })
    .from(ask)
    .where(and(eq(ask.kind, ASK_KINDS.ask), inPeriod(ask.createdAt, period)));
  const ids = asks.map(({ id }) => id);
  const [offers, answers, intros] = await Promise.all([
    ids.length ? database.select({ askId: askOffer.askId, by: askOffer.helperId, at: askOffer.createdAt }).from(askOffer).where(inArray(askOffer.askId, ids)) : [],
    ids.length ? database.select({ askId: askAnswer.askId, by: askAnswer.authorId, at: askAnswer.createdAt }).from(askAnswer).where(inArray(askAnswer.askId, ids)) : [],
    database
      .select({ total: sql<number>`count(*)`.mapWith(Number), made: sql<number>`count(*) filter (where ${introRequest.state} = ${INTRO_STATES.completed})`.mapWith(Number) })
      .from(introRequest)
      .where(and(eq(introRequest.isWithheld, false), sql`${introRequest.askId} is not null`, inPeriod(introRequest.createdAt, period))),
  ]);
  const oldestOpen = now.getTime() - ASK_LIMITS.lifetimeDays * DAY_MS;
  const firstHelpHours = asks.flatMap((item) => {
    const times = [...offers, ...answers].filter(({ askId, by }) => askId === item.id && by !== item.authorId).map(({ at }) => at.getTime());
    return times.length ? [(Math.min(...times) - item.createdAt.getTime()) / HOUR_MS] : [];
  });
  return {
    posted: asks.length,
    answered: asks.filter(({ outcome }) => outcome === ASK_OUTCOMES.solvedHere).length,
    open: asks.filter(({ closedAt, listedAt }) => !closedAt && listedAt.getTime() > oldestOpen).length,
    helped: firstHelpHours.length,
    medianHours: median(firstHelpHours),
    intros: intros[0]?.total ?? 0,
    introsMade: intros[0]?.made ?? 0,
  };
}

export async function readReportStats(database: Database, param: ConsolePeriodParam, now = new Date()): Promise<ReportStats> {
  const period = readConsolePeriod(param, now);
  await expireDueIntros(database, null);
  const [{ isAsksOn }, branding, rows, firstAskAt, outcomeDays] = await Promise.all([
    readReportOptions(database),
    readBranding(database),
    readIntroRows(database, period),
    readFirstAskAt(database),
    readOutcomeDays(database),
  ]);
  const asks = isAsksOn ? await readAskStats(database, period, now) : null;
  const intros = computeReportStats(rows, { now, outcomeDays });
  return {
    communityName: branding.name,
    period,
    intros,
    asks,
    summary: readSummaryLine(intros, period, { firstAskAt, now }),
    title: readReportTitle(branding.name, period, intros),
  };
}
