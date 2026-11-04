import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { rateLimit } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";

const SETUP_KEY_PREFIX = "setup";
const WINDOW_MS = 60_000;
const MAXIMUM_FAILED_ATTEMPTS = 10;

export async function recordFailedSetupAttempt(database: Database, clientKey: string) {
  const now = Date.now();
  const isWindowExpired = sql`${rateLimit.lastRequest} <= ${now - WINDOW_MS}`;

  const [attempts] = await database
    .insert(rateLimit)
    .values({
      id: randomUUID(),
      key: `${SETUP_KEY_PREFIX}|${clientKey}`,
      count: 1,
      lastRequest: now,
    })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${isWindowExpired} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${isWindowExpired} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: rateLimit.count });

  return { isLimited: (attempts?.count ?? 0) > MAXIMUM_FAILED_ATTEMPTS };
}
