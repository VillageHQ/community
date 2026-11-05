import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../../database/client.ts";
import { memberDailyUsage } from "../../database/village-schema.ts";
import { VillageApiError } from "./client.ts";

export const DAILY_CREDIT_CALL_LIMIT = 50;

const DATE_LENGTH = "YYYY-MM-DD".length;

export class DailyLimitReachedError extends Error {}

function readUsageDate() {
  return new Date().toISOString().slice(0, DATE_LENGTH);
}

async function reserveCreditCall(database: Database, userId: string, usageDate: string) {
  const reservations = await database
    .insert(memberDailyUsage)
    .values({ userId, usageDate, callCount: 1 })
    .onConflictDoUpdate({
      target: [memberDailyUsage.userId, memberDailyUsage.usageDate],
      set: { callCount: sql`${memberDailyUsage.callCount} + 1` },
      where: sql`${memberDailyUsage.callCount} < ${DAILY_CREDIT_CALL_LIMIT}`,
    })
    .returning({ callCount: memberDailyUsage.callCount });
  return reservations.length > 0;
}

async function releaseCreditCall(database: Database, userId: string, usageDate: string) {
  await database
    .update(memberDailyUsage)
    .set({ callCount: sql`${memberDailyUsage.callCount} - 1` })
    .where(and(eq(memberDailyUsage.userId, userId), eq(memberDailyUsage.usageDate, usageDate)));
}

export async function readDailyLookupsLeft(database: Database, userId: string) {
  const [usage] = await database
    .select({ callCount: memberDailyUsage.callCount })
    .from(memberDailyUsage)
    .where(and(eq(memberDailyUsage.userId, userId), eq(memberDailyUsage.usageDate, readUsageDate())));
  return Math.max(DAILY_CREDIT_CALL_LIMIT - (usage?.callCount ?? 0), 0);
}

function wasNotDebited(error: unknown) {
  return error instanceof VillageApiError && error.isVillageErrorResponse;
}

export async function withCreditCall<Result>(
  database: Database,
  userId: string,
  spendCredits: () => Promise<Result>,
) {
  const usageDate = readUsageDate();
  if (!(await reserveCreditCall(database, userId, usageDate))) throw new DailyLimitReachedError();

  try {
    return await spendCredits();
  } catch (error) {
    if (wasNotDebited(error)) await releaseCreditCall(database, userId, usageDate);
    throw error;
  }
}
