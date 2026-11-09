import { randomUUID } from "node:crypto";

import { and, eq, gt, sql } from "drizzle-orm";

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

// Reads without counting, for a limit that only failures should fill.
export async function hasTooManyFailedAttempts(database: Database, key: string, maximumAttempts = MAXIMUM_FAILED_ATTEMPTS) {
  const [attempts] = await database
    .select({ count: rateLimit.count })
    .from(rateLimit)
    .where(and(eq(rateLimit.key, key), gt(rateLimit.lastRequest, Date.now() - WINDOW_MS)));
  return (attempts?.count ?? 0) >= maximumAttempts;
}
