import "server-only";

import { and, desc, eq, gte, inArray, lt, min, sql, type SQL } from "drizzle-orm";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberProfile } from "../members/schema.ts";
import { INTRO_OUTCOMES, INTRO_RESULTS, INTRO_STATES, OPEN_INTRO_STATES, type IntroResult } from "./contract.ts";
import { expireDueIntros } from "./reads.ts";
import { introRequest } from "./schema.ts";

// The partner report's intro numbers. This is their only source: the report page, its CSV and its email all read
// this, so they can't disagree. An intro belongs to the period it was asked in, so each period adds up:
// asked = introduced + declined + expired + withdrawn + open. Withheld asks never reached a connector and are left
// out. Nothing here returns who asked whom: only counts, and the names of connectors who chose to be credited.

export type ReportPeriod = { from: Date | null; to: Date | null };

export const TOP_CONNECTOR_LIMIT = 5;

const MEDIAN_DECIMALS = 10;

function isInPeriod({ from, to }: ReportPeriod) {
  return and(eq(introRequest.isWithheld, false), from ? gte(introRequest.createdAt, from) : undefined, to ? lt(introRequest.createdAt, to) : undefined);
}

function countWhere(condition: SQL) {
  return sql<number>`count(*) filter (where ${condition})`.mapWith(Number);
}

function inStates(states: readonly string[]) {
  return sql`${introRequest.state} in (${sql.join(
    states.map((state) => sql`${state}`),
    sql`, `,
  )})`;
}

const connectorSaidYes = sql`(${introRequest.acceptedAt} is not null or ${introRequest.askedTargetAt} is not null)`;
const targetSaidYes = sql`(${introRequest.targetAgreedAt} is not null or ${introRequest.state} = ${INTRO_STATES.completed})`;
const introduced = sql`${introRequest.state} = ${INTRO_STATES.completed}`;

function hasResult(result: IntroResult) {
  return sql`${result} = any(${introRequest.outcomeResults})`;
}

async function readCounts(database: Database, period: ReportPeriod) {
  const [row] = await database
    .select({
      asked: countWhere(sql`true`),
      connectorSaidYes: countWhere(connectorSaidYes),
      targetSaidYes: countWhere(targetSaidYes),
      introduced: countWhere(introduced),
      declinedByConnector: countWhere(sql`${introRequest.state} = ${INTRO_STATES.declined}`),
      declinedByTarget: countWhere(sql`${introRequest.state} = ${INTRO_STATES.targetDeclined}`),
      expiredAtConnector: countWhere(sql`${introRequest.state} = ${INTRO_STATES.expired} and not ${connectorSaidYes}`),
      expiredAtTarget: countWhere(sql`${introRequest.state} = ${INTRO_STATES.expired} and ${introRequest.askedTargetAt} is not null and ${introRequest.targetAgreedAt} is null`),
      expiredBeforeIntro: countWhere(sql`${introRequest.state} = ${INTRO_STATES.expired} and ${connectorSaidYes} and not (${introRequest.askedTargetAt} is not null and ${introRequest.targetAgreedAt} is null)`),
      withdrawn: countWhere(sql`${introRequest.state} = ${INTRO_STATES.withdrawn}`),
      open: countWhere(inStates(OPEN_INTRO_STATES)),
      helped: countWhere(sql`${introRequest.outcome} = ${INTRO_OUTCOMES.helped}`),
      notHelped: countWhere(sql`${introRequest.outcome} = ${INTRO_OUTCOMES.notHelped}`),
      notYet: countWhere(sql`${introRequest.outcome} = ${INTRO_OUTCOMES.notYet}`),
      unanswered: countWhere(sql`${introduced} and ${introRequest.outcome} is null`),
      customer: countWhere(hasResult(INTRO_RESULTS.customer)),
      hire: countWhere(hasResult(INTRO_RESULTS.hire)),
      investor: countWhere(hasResult(INTRO_RESULTS.investor)),
      medianDaysToIntroduced: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (${introRequest.closedAt} - ${introRequest.createdAt})) / 86400) filter (where ${introduced} and ${introRequest.closedAt} is not null)`.mapWith(
        (value) => (value === null ? null : Math.round(Number(value) * MEDIAN_DECIMALS) / MEDIAN_DECIMALS),
      ),
    })
    .from(introRequest)
    .where(isInPeriod(period));
  if (!row) throw new Error("The intro report read returned no row.");
  const { declinedByConnector, declinedByTarget, expiredAtConnector, expiredAtTarget, expiredBeforeIntro, helped, notHelped, customer, hire, investor, ...rest } = row;
  return {
    ...rest,
    declined: declinedByConnector + declinedByTarget,
    declinedByConnector,
    declinedByTarget,
    expired: expiredAtConnector + expiredAtTarget + expiredBeforeIntro,
    expiredAtConnector,
    expiredAtTarget,
    expiredBeforeIntro,
    helped,
    notHelped,
    helpedPercent: helped + notHelped === 0 ? null : Math.round((helped / (helped + notHelped)) * 100),
    results: { customer, hire, investor },
  };
}

// Connectors who made at least one intro in the period, most intros first.
async function readConnectorRows(database: Database, period: ReportPeriod) {
  const introducedCount = countWhere(introduced);
  return database
    .select({
      id: introRequest.introducerId,
      introduced: introducedCount,
      name: user.name,
      isCredited: sql<boolean>`coalesce(bool_or(${memberProfile.creditInReports} and ${isActiveMember()}), false)`,
    })
    .from(introRequest)
    .innerJoin(user, eq(user.id, introRequest.introducerId))
    .leftJoin(memberProfile, eq(memberProfile.userId, introRequest.introducerId))
    .where(isInPeriod(period))
    .groupBy(introRequest.introducerId, user.name)
    .having(sql`${introducedCount} > 0`)
    .orderBy(desc(introducedCount), desc(countWhere(connectorSaidYes)), user.name, introRequest.introducerId);
}

// The named connectors: the top credited ones over the whole history, so every period names the same people.
// Only a member who turned on "credit me in reports", and is still an active member, can be named.
async function readNamedConnectorIds(database: Database) {
  const rows = await readConnectorRows(database, { from: null, to: null });
  return rows.filter(({ isCredited }) => isCredited).slice(0, TOP_CONNECTOR_LIMIT).map(({ id }) => id);
}

// Everyone not named is folded into one count, so named + others always covers every intro made.
async function readConnectors(database: Database, period: ReportPeriod, namedIds: readonly string[]) {
  const rows = await readConnectorRows(database, period);
  const others = rows.filter(({ id, isCredited }) => !(isCredited && namedIds.includes(id)));
  return {
    named: namedIds.map((id) => {
      const row = rows.find((candidate) => candidate.id === id && candidate.isCredited);
      return { id, introduced: row?.introduced ?? 0 };
    }),
    others: { connectors: others.length, introduced: others.reduce((total, row) => total + row.introduced, 0) },
  };
}

async function readConnectorNames(database: Database, ids: readonly string[]) {
  if (ids.length === 0) return [];
  const rows = await database.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, [...ids]));
  return ids.map((id) => ({ id, name: rows.find((row) => row.id === id)?.name ?? "" }));
}

// Intros by the cohort of the member who asked, for cohorts members wrote on their card. Counts only. A cohort is one
// value whatever its case or outer spaces, so "Fund II" and "fund ii " count together.
async function readCohortCounts(database: Database, period: ReportPeriod) {
  const cohortKey = sql<string>`lower(trim(${memberProfile.cohort}))`;
  return database
    .select({ key: cohortKey, label: min(sql<string>`trim(${memberProfile.cohort})`), asked: countWhere(sql`true`), introduced: countWhere(introduced) })
    .from(introRequest)
    .innerJoin(memberProfile, eq(memberProfile.userId, introRequest.requesterId))
    .where(and(isInPeriod(period), sql`nullif(trim(${memberProfile.cohort}), '') is not null`))
    .groupBy(cohortKey)
    .orderBy(cohortKey);
}

export async function readIntroReport(database: Database, period: ReportPeriod, namedIds?: readonly string[]) {
  const named = namedIds ?? (await readNamedConnectorIds(database));
  const [counts, connectors, byCohort] = await Promise.all([readCounts(database, period), readConnectors(database, period, named), readCohortCounts(database, period)]);
  return { ...counts, connectors, byCohort: byCohort.map(({ key, label, asked, introduced }) => ({ key, label: label ?? key, asked, introduced })) };
}

export type IntroReport = Awaited<ReturnType<typeof readIntroReport>>;

// Due expiries are applied first, so an ask past its deadline counts as expired, never as open.
export async function readIntroReports<Key extends string>(database: Database, periods: Record<Key, ReportPeriod>) {
  await expireDueIntros(database, null);
  const namedIds = await readNamedConnectorIds(database);
  const entries = await Promise.all(Object.entries<ReportPeriod>(periods).map(async ([key, period]) => [key, await readIntroReport(database, period, namedIds)] as const));
  return { periods: Object.fromEntries(entries) as Record<Key, IntroReport>, namedConnectors: await readConnectorNames(database, namedIds) };
}
