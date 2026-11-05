import "server-only";

import type { Database } from "../../platform/database/client.ts";
import { recordFailedAttempt } from "../../platform/rate-limit/attempt-rate-limit.ts";
import { readRateLimitClientKey } from "../../platform/http/client-ip.ts";
import type { Environment } from "../../platform/environment.ts";
import { pruneExpiredRateLimits } from "../../platform/rate-limit/rate-limit-pruning.ts";

const INVITE_KEY_PREFIX = "invite";

export async function recordFailedInviteAttempt(
  database: Database,
  request: Request | Headers,
  environment: Environment,
) {
  await pruneExpiredRateLimits(database);
  return recordFailedAttempt(database, `${INVITE_KEY_PREFIX}|${readRateLimitClientKey(request, environment)}`);
}
