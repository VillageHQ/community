import "server-only";

import type { Database } from "../../platform/database/client.ts";
import { recordFailedAttempt } from "../../platform/rate-limit/attempt-rate-limit.ts";
import { pruneExpiredRateLimits } from "../../platform/rate-limit/rate-limit-pruning.ts";
import { NetworkRequestError } from "../../platform/http/request-error.ts";
import { FEED_ERROR_CODES } from "./feed-api.ts";

const TOO_MANY_REQUESTS_STATUS = 429;
const SLOW_DOWN_MESSAGE = "You're posting fast. Give it a minute and try again.";

export const POSTING_KINDS = { post: "post", comment: "comment" } as const;

type PostingKind = (typeof POSTING_KINDS)[keyof typeof POSTING_KINDS];

export const MAXIMUM_PER_MINUTE: Record<PostingKind, number> = {
  [POSTING_KINDS.post]: 10,
  [POSTING_KINDS.comment]: 30,
};

export async function enforcePostingLimit(database: Database, memberId: string, kind: PostingKind) {
  await pruneExpiredRateLimits(database);
  const { isLimited } = await recordFailedAttempt(database, `feed-${kind}|${memberId}`, MAXIMUM_PER_MINUTE[kind]);
  if (isLimited) throw new NetworkRequestError(TOO_MANY_REQUESTS_STATUS, FEED_ERROR_CODES.tooFast, SLOW_DOWN_MESSAGE);
}
