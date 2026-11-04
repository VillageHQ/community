import { inArray, lt } from "drizzle-orm";

import { rateLimit } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import { logError } from "./route-logging.ts";

const RETENTION_MS = 5 * 60_000;
const PRUNE_INTERVAL_MS = 60_000;
const PRUNE_BATCH_SIZE = 500;

let lastPrunedAt = 0;

export async function pruneExpiredRateLimits(database: Database) {
  const now = Date.now();
  if (now - lastPrunedAt < PRUNE_INTERVAL_MS) return;
  lastPrunedAt = now;

  const expiredRows = database
    .select({ id: rateLimit.id })
    .from(rateLimit)
    .where(lt(rateLimit.lastRequest, now - RETENTION_MS))
    .limit(PRUNE_BATCH_SIZE);

  try {
    await database.delete(rateLimit).where(inArray(rateLimit.id, expiredRows));
  } catch (error) {
    logError("rate-limit-pruning", error);
  }
}
