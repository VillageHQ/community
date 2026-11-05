import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { memberDailyUsage } from "../../database/village-schema.ts";
import { VillageApiError } from "./client.ts";
import { clearVillageOutOfCredits, readDailyLookupLimit } from "./settings.ts";

const DATE_LENGTH = "YYYY-MM-DD".length;

export class DailyLimitReachedError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super(`The daily limit of ${limit} lookups is used up.`);
    this.limit = limit;
  }
}

function readUsageDate() {
  return new Date().toISOString().slice(0, DATE_LENGTH);
}

export const CREDIT_CALL_KINDS = { search: "search", path: "path" } as const;

type CreditCallKind = (typeof CREDIT_CALL_KINDS)[keyof typeof CREDIT_CALL_KINDS];

const SEARCH_INCREMENT: Record<CreditCallKind, number> = { [CREDIT_CALL_KINDS.search]: 1, [CREDIT_CALL_KINDS.path]: 0 };

async function reserveCreditCall(database: Database, userId: string, usageDate: string, limit: number, kind: CreditCallKind) {
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

async function releaseCreditCall(database: Database, userId: string, usageDate: string, kind: CreditCallKind) {
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

function wasNotDebited(error: unknown) {
  return error instanceof VillageApiError && error.isVillageErrorResponse;
}

export async function withCreditCall<Result>(
  database: Database,
  userId: string,
  kind: CreditCallKind,
  spendCredits: () => Promise<Result>,
) {
  const usageDate = readUsageDate();
  const limit = await readDailyLookupLimit(database);
  if (!(await reserveCreditCall(database, userId, usageDate, limit, kind))) throw new DailyLimitReachedError(limit);

  try {
    const result = await spendCredits();
    await clearVillageOutOfCredits(database);
    return result;
  } catch (error) {
    if (wasNotDebited(error)) await releaseCreditCall(database, userId, usageDate, kind);
    throw error;
  }
}
