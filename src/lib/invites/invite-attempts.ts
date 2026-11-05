import "server-only";

import type { Database } from "../../database/client.ts";
import { recordFailedAttempt } from "../attempt-rate-limit.ts";
import { readRateLimitClientKey } from "../client-ip.ts";
import type { Environment } from "../environment.ts";
import { pruneExpiredRateLimits } from "../rate-limit-pruning.ts";

const INVITE_KEY_PREFIX = "invite";

export async function recordFailedInviteAttempt(
  database: Database,
  request: Request | Headers,
  environment: Environment,
) {
  await pruneExpiredRateLimits(database);
  return recordFailedAttempt(database, `${INVITE_KEY_PREFIX}|${readRateLimitClientKey(request, environment)}`);
}
