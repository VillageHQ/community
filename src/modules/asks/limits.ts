import "server-only";

import type { Database } from "../../platform/database/client.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { recordFailedAttempt } from "../../platform/rate-limit/attempt-rate-limit.ts";
import { pruneExpiredRateLimits } from "../../platform/rate-limit/rate-limit-pruning.ts";
import { ASK_ERROR_CODES } from "./contract.ts";

const TOO_MANY_REQUESTS_STATUS = 429;
const SLOW_DOWN_MESSAGE = "You're posting fast. Give it a minute and try again.";

export const ASK_POSTING_KINDS = { ask: "ask", offer: "offer" } as const;

type AskPostingKind = (typeof ASK_POSTING_KINDS)[keyof typeof ASK_POSTING_KINDS];

export const ASK_MAXIMUM_PER_MINUTE: Record<AskPostingKind, number> = {
  [ASK_POSTING_KINDS.ask]: 10,
  [ASK_POSTING_KINDS.offer]: 30,
};

export async function enforceAskPostingLimit(database: Database, memberId: string, kind: AskPostingKind) {
  await pruneExpiredRateLimits(database);
  const { isLimited } = await recordFailedAttempt(database, `asks-${kind}|${memberId}`, ASK_MAXIMUM_PER_MINUTE[kind]);
  if (isLimited) throw new RequestError(TOO_MANY_REQUESTS_STATUS, ASK_ERROR_CODES.tooFast, SLOW_DOWN_MESSAGE);
}
