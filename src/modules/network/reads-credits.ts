import "server-only";

import { and, desc, eq, gte, sql, sum } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberDailyUsage } from "../../platform/village/schema.ts";
import { isBanActive } from "../../platform/auth/member-status.ts";
import { CREDITS_PER_FULL_SEARCH, CREDITS_PER_PATH_LOOKUP, USD_PER_CREDIT } from "./contract.ts";

const USAGE_WINDOW_DAYS = 30;
const MAXIMUM_MEMBERS_SHOWN = 50;
const MILLISECONDS_PER_DAY = 86_400_000;
const DATE_LENGTH = "YYYY-MM-DD".length;

function toUsageDate(date: Date) {
  return date.toISOString().slice(0, DATE_LENGTH);
}

type LookupCounts = { searches: number; pathLookups: number };

export function estimateCreditCost({ searches, pathLookups }: LookupCounts) {
  const credits = searches * CREDITS_PER_FULL_SEARCH + pathLookups * CREDITS_PER_PATH_LOOKUP;
  return { credits, dollars: credits * USD_PER_CREDIT };
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatDollars(dollars: number) {
  return USD.format(dollars);
}

export function describeCreditEstimate(lookups: LookupCounts) {
  if (lookups.searches + lookups.pathLookups === 0) return "Nothing spent yet";
  const { credits, dollars } = estimateCreditCost(lookups);
  return `Estimate: about ${credits.toLocaleString("en-US")} credits, or ${formatDollars(dollars)}`;
}

function toLookupCounts({ lookups, searches }: { lookups: string | null; searches: string | null }) {
  const searchCount = Number(searches);
  return { searches: searchCount, pathLookups: Number(lookups) - searchCount };
}

async function readDailyLookups(database: Database, sinceDate: string) {
  const lookups = sum(memberDailyUsage.callCount);
  const rows = await database
    .select({ usageDate: memberDailyUsage.usageDate, lookups, searches: sum(memberDailyUsage.searchCount) })
    .from(memberDailyUsage)
    .where(gte(memberDailyUsage.usageDate, sinceDate))
    .groupBy(memberDailyUsage.usageDate)
    .orderBy(desc(memberDailyUsage.usageDate));
  return rows.map((row) => ({ usageDate: row.usageDate, lookups: Number(row.lookups), ...toLookupCounts(row) }));
}

async function readMemberLookups(database: Database, sinceDate: string, today: string) {
  const lookups = sum(memberDailyUsage.callCount);
  const rows = await database
    .select({
      id: user.id,
      name: user.name,
      banned: user.banned,
      banExpires: user.banExpires,
      lookups,
      searches: sum(memberDailyUsage.searchCount),
      lookupsToday: sql<string>`coalesce(sum(${memberDailyUsage.callCount}) filter (where ${eq(memberDailyUsage.usageDate, today)}), 0)`,
    })
    .from(memberDailyUsage)
    .innerJoin(user, eq(user.id, memberDailyUsage.userId))
    .where(and(gte(memberDailyUsage.usageDate, sinceDate), sql`${memberDailyUsage.callCount} > 0`))
    .groupBy(user.id)
    .orderBy(desc(lookups), user.name)
    .limit(MAXIMUM_MEMBERS_SHOWN);
  return rows.map(({ banned, banExpires, ...row }) => ({
    ...row,
    ...toLookupCounts(row),
    isRemoved: isBanActive({ banned, banExpires }),
    lookups: Number(row.lookups),
    lookupsToday: Number(row.lookupsToday),
  }));
}

async function readSpendingMemberCount(database: Database, sinceDate: string) {
  const [row] = await database
    .select({ memberCount: sql<number>`count(distinct ${memberDailyUsage.userId})`.mapWith(Number) })
    .from(memberDailyUsage)
    .where(and(gte(memberDailyUsage.usageDate, sinceDate), sql`${memberDailyUsage.callCount} > 0`));
  return row?.memberCount ?? 0;
}

export async function readCreditUsage(database: Database, now = new Date()) {
  const today = toUsageDate(now);
  const sinceDate = toUsageDate(new Date(now.getTime() - (USAGE_WINDOW_DAYS - 1) * MILLISECONDS_PER_DAY));
  const [days, members, spendingMemberCount] = await Promise.all([
    readDailyLookups(database, sinceDate),
    readMemberLookups(database, sinceDate, today),
    readSpendingMemberCount(database, sinceDate),
  ]);
  const totalLookups = days.reduce((total, day) => total + day.lookups, 0);
  const totalSearches = days.reduce((total, day) => total + day.searches, 0);
  return {
    windowDays: USAGE_WINDOW_DAYS,
    totalLookups,
    totalSearches,
    totalPathLookups: totalLookups - totalSearches,
    days: days.filter(({ lookups }) => lookups > 0),
    members,
    spendingMemberCount,
    lookupsToday: days.find(({ usageDate }) => usageDate === today)?.lookups ?? 0,
  };
}
