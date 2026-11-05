import "server-only";

import type { Database } from "../../platform/database/client.ts";
import { recordFailedAttempt } from "../../platform/rate-limit/attempt-rate-limit.ts";
import { pruneExpiredRateLimits } from "../../platform/rate-limit/rate-limit-pruning.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { INTRO_ERROR_CODES } from "./contract.ts";

const TOO_MANY_REQUESTS_STATUS = 429;

export const INTRO_LIMIT_KINDS = { ask: "ask", respond: "respond", read: "read" } as const;

type IntroLimitKind = (typeof INTRO_LIMIT_KINDS)[keyof typeof INTRO_LIMIT_KINDS];

export const INTRO_MAXIMUM_PER_MINUTE: Record<IntroLimitKind, number> = {
  [INTRO_LIMIT_KINDS.ask]: 10,
  [INTRO_LIMIT_KINDS.respond]: 30,
  [INTRO_LIMIT_KINDS.read]: 300,
};

const SLOW_DOWN_MESSAGES: Record<IntroLimitKind, string> = {
  [INTRO_LIMIT_KINDS.ask]: "You're asking fast. Give it a minute and try again.",
  [INTRO_LIMIT_KINDS.respond]: "That's a lot of changes at once. Give it a minute and try again.",
  [INTRO_LIMIT_KINDS.read]: "You're checking very often. Give it a minute and try again.",
};

export async function enforceIntroLimit(database: Database, memberId: string, kind: IntroLimitKind) {
  await pruneExpiredRateLimits(database);
  const { isLimited } = await recordFailedAttempt(database, `intros-${kind}|${memberId}`, INTRO_MAXIMUM_PER_MINUTE[kind]);
  if (isLimited) throw new RequestError(TOO_MANY_REQUESTS_STATUS, INTRO_ERROR_CODES.tooFast, SLOW_DOWN_MESSAGES[kind]);
}
