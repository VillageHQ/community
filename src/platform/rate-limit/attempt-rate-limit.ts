import { randomUUID } from "node:crypto";

import { and, eq, gt, lte, sql } from "drizzle-orm";

import { rateLimit } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";

const WINDOW_MS = 60_000;
const MAXIMUM_FAILED_ATTEMPTS = 10;

export async function recordFailedAttempt(database: Database, key: string, maximumAttempts = MAXIMUM_FAILED_ATTEMPTS) {
  const now = Date.now();
  const isWindowExpired = sql`${rateLimit.lastRequest} <= ${now - WINDOW_MS}`;

  const [attempts] = await database
    .insert(rateLimit)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${isWindowExpired} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${isWindowExpired} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: rateLimit.count });

  return { isLimited: (attempts?.count ?? 0) > maximumAttempts };
}

// Gives back an attempt counted up front, once it turned out not to be a failure. Counting
// before the check and refunding after caps guesses sent all at once, which a read-then-record
// limit lets through.
export async function releaseAttempt(database: Database, key: string) {
  const inWindow = and(eq(rateLimit.key, key), gt(rateLimit.lastRequest, Date.now() - WINDOW_MS));
  const [released] = await database
    .update(rateLimit)
    .set({ count: sql`${rateLimit.count} - 1` })
    .where(and(inWindow, gt(rateLimit.count, 1)))
    .returning({ id: rateLimit.id });
  // The last one counted leaves nothing behind.
  if (!released) await database.delete(rateLimit).where(and(eq(rateLimit.key, key), lte(rateLimit.count, 1)));
}
