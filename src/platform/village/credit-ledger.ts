import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { logError } from "../observability/route-logging.ts";
import { memberDailyUsage, villageMonthlyUsage } from "./schema.ts";
import { isVillageErrorResponse } from "./client.ts";
import { CREDIT_CALL_KINDS, ESTIMATED_CREDITS, NEAR_CAP_PERCENT, type CreditCallKind } from "./contract.ts";
import { CREDIT_WARNING_LEVELS, warnAdminsAboutCredits, type CreditWarningLevel } from "./credit-warnings.ts";
import { clearVillageOutOfCredits, readDailyLookupLimit, readMonthlyCreditCap } from "./settings.ts";

const DATE_LENGTH = "YYYY-MM-DD".length;
const MONTH_LENGTH = "YYYY-MM".length;
const WHOLE_PERCENT = 100;

export { CREDIT_CALL_KINDS };

export class DailyLimitReachedError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super(`The daily limit of ${limit} lookups is used up.`);
    this.limit = limit;
  }
}

export class MonthlyCapReachedError extends Error {
  readonly cap: number;

  constructor(cap: number) {
    super(`The community's monthly cap of ${cap} credits is used up.`);
    this.cap = cap;
  }
}

function readUsageDate() {
  return new Date().toISOString().slice(0, DATE_LENGTH);
}

export function readUsageMonth(now = new Date()) {
  return now.toISOString().slice(0, MONTH_LENGTH);
}

const SEARCH_INCREMENT: Record<CreditCallKind, number> = {
  [CREDIT_CALL_KINDS.search]: 1,
  [CREDIT_CALL_KINDS.path]: 0,
  [CREDIT_CALL_KINDS.fillIn]: 0,
};

function readFillInCredits(kind: CreditCallKind) {
  return kind === CREDIT_CALL_KINDS.fillIn ? ESTIMATED_CREDITS[kind] : 0;
}

// The row exists first, so the reservation is one conditional UPDATE. Postgres locks the row for it,
// so two calls at once see each other's credits, and only one of them can take the last ones.
async function reserveMonthlyCredits(database: Database, usageMonth: string, cap: number, kind: CreditCallKind) {
  const credits = ESTIMATED_CREDITS[kind];
  await database.insert(villageMonthlyUsage).values({ usageMonth }).onConflictDoNothing();
  const [reserved] = await database
    .update(villageMonthlyUsage)
    .set({
      credits: sql`${villageMonthlyUsage.credits} + ${credits}`,
      fillInCredits: sql`${villageMonthlyUsage.fillInCredits} + ${readFillInCredits(kind)}`,
    })
    .where(and(eq(villageMonthlyUsage.usageMonth, usageMonth), sql`${villageMonthlyUsage.credits} + ${credits} <= ${cap}`))
    .returning({ credits: villageMonthlyUsage.credits });
  return reserved?.credits ?? null;
}

async function releaseMonthlyCredits(database: Database, usageMonth: string, kind: CreditCallKind) {
  await database
    .update(villageMonthlyUsage)
    .set({
      credits: sql`greatest(${villageMonthlyUsage.credits} - ${ESTIMATED_CREDITS[kind]}, 0)`,
      fillInCredits: sql`greatest(${villageMonthlyUsage.fillInCredits} - ${readFillInCredits(kind)}, 0)`,
    })
    .where(eq(villageMonthlyUsage.usageMonth, usageMonth));
}

async function reserveDailyCall(database: Database, userId: string, usageDate: string, limit: number, kind: CreditCallKind) {
  const reservations = await database
    .insert(memberDailyUsage)
    .values({ userId, usageDate, callCount: 1, searchCount: SEARCH_INCREMENT[kind] })
    .onConflictDoUpdate({
      target: [memberDailyUsage.userId, memberDailyUsage.usageDate],
      set: {
        callCount: sql`${memberDailyUsage.callCount} + 1`,
        searchCount: sql`${memberDailyUsage.searchCount} + ${SEARCH_INCREMENT[kind]}`,
      },
      where: sql`${memberDailyUsage.callCount} < ${limit}`,
    })
    .returning({ callCount: memberDailyUsage.callCount });
  return reservations.length > 0;
}

async function releaseDailyCall(database: Database, userId: string, usageDate: string, kind: CreditCallKind) {
  await database
    .update(memberDailyUsage)
    .set({
      callCount: sql`${memberDailyUsage.callCount} - 1`,
      searchCount: sql`${memberDailyUsage.searchCount} - ${SEARCH_INCREMENT[kind]}`,
    })
    .where(and(eq(memberDailyUsage.userId, userId), eq(memberDailyUsage.usageDate, usageDate)));
}

export async function readDailyLookupsLeft(database: Database, userId: string) {
  const [limit, [usage]] = await Promise.all([
    readDailyLookupLimit(database),
    database
      .select({ callCount: memberDailyUsage.callCount })
      .from(memberDailyUsage)
      .where(and(eq(memberDailyUsage.userId, userId), eq(memberDailyUsage.usageDate, readUsageDate()))),
  ]);
  return Math.max(limit - (usage?.callCount ?? 0), 0);
}

export async function readMonthlyCreditUsage(database: Database, now = new Date()) {
  const usageMonth = readUsageMonth(now);
  const [cap, [usage]] = await Promise.all([
    readMonthlyCreditCap(database),
    database.select().from(villageMonthlyUsage).where(eq(villageMonthlyUsage.usageMonth, usageMonth)),
  ]);
  const credits = usage?.credits ?? 0;
  return {
    usageMonth,
    cap,
    credits,
    fillInCredits: usage?.fillInCredits ?? 0,
    usedPercent: Math.min(Math.floor((credits * WHOLE_PERCENT) / cap), WHOLE_PERCENT),
    warnedNearCapAt: usage?.warnedNearCapAt ?? null,
    warnedAtCapAt: usage?.warnedAtCapAt ?? null,
  };
}

// Who pays. A member's own searches and paths also count toward their daily limit. A fill-in only
// counts toward the community's month, because the nightly job has no member behind it.
export type CreditSpender = { database: Database; environment: Environment; memberId: string | null };

// Every level the month has reached. A jump past both sends both, the early one first.
function readCrossedLevels(credits: number, cap: number): CreditWarningLevel[] {
  const levels: CreditWarningLevel[] = [];
  if (credits * WHOLE_PERCENT >= cap * NEAR_CAP_PERCENT) levels.push(CREDIT_WARNING_LEVELS.nearCap);
  if (credits >= cap) levels.push(CREDIT_WARNING_LEVELS.atCap);
  return levels;
}

// A warning that can't be queued must never fail the call that triggered it.
async function warnSafely(spender: CreditSpender, usageMonth: string, cap: number, levels: readonly CreditWarningLevel[]) {
  for (const level of levels) {
    try {
      await warnAdminsAboutCredits(spender.database, spender.environment, { usageMonth, cap, level });
    } catch (error) {
      logError("village-credit-warning", error);
    }
  }
}

const ALWAYS_CHARGED = () => true;

function readDailyMemberId({ memberId }: CreditSpender, kind: CreditCallKind) {
  return kind === CREDIT_CALL_KINDS.fillIn ? null : memberId;
}

// Reserves the call's estimate against the month (and the member's day) before Village is called,
// and gives it back when Village refuses or says nothing was charged.
export async function withCreditCall<Result>(
  spender: CreditSpender,
  kind: CreditCallKind,
  spendCredits: () => Promise<Result>,
  wasCharged: (result: Result) => boolean = ALWAYS_CHARGED,
) {
  const { database } = spender;
  const usageMonth = readUsageMonth();
  const usageDate = readUsageDate();
  const cap = await readMonthlyCreditCap(database);
  const reservedCredits = await reserveMonthlyCredits(database, usageMonth, cap, kind);
  if (reservedCredits === null) {
    await warnSafely(spender, usageMonth, cap, [CREDIT_WARNING_LEVELS.nearCap, CREDIT_WARNING_LEVELS.atCap]);
    throw new MonthlyCapReachedError(cap);
  }

  const dailyMemberId = readDailyMemberId(spender, kind);
  if (dailyMemberId) {
    const limit = await readDailyLookupLimit(database);
    if (!(await reserveDailyCall(database, dailyMemberId, usageDate, limit, kind))) {
      await releaseMonthlyCredits(database, usageMonth, kind);
      throw new DailyLimitReachedError(limit);
    }
  }

  const release = async () => {
    await releaseMonthlyCredits(database, usageMonth, kind);
    if (dailyMemberId) await releaseDailyCall(database, dailyMemberId, usageDate, kind);
  };

  let result: Result;
  try {
    result = await spendCredits();
  } catch (error) {
    if (isVillageErrorResponse(error)) await release();
    throw error;
  }
  if (!wasCharged(result)) {
    await release();
    return result;
  }
  await clearVillageOutOfCredits(database);
  await warnSafely(spender, usageMonth, cap, readCrossedLevels(reservedCredits, cap));
  return result;
}
