import "server-only";

import type { Database } from "../../platform/database/client.ts";
import { recordFailedAttempt } from "../../platform/rate-limit/attempt-rate-limit.ts";
import { pruneExpiredRateLimits } from "../../platform/rate-limit/rate-limit-pruning.ts";
import { NetworkRequestError } from "../../platform/http/request-error.ts";
import { MESSAGE_ERROR_CODES } from "./contract.ts";

const TOO_MANY_REQUESTS_STATUS = 429;

export const MESSAGING_KINDS = { send: "send", start: "start", report: "report", poll: "poll" } as const;

type MessagingKind = (typeof MESSAGING_KINDS)[keyof typeof MESSAGING_KINDS];

export const MESSAGING_MAXIMUM_PER_MINUTE: Record<MessagingKind, number> = {
  [MESSAGING_KINDS.send]: 30,
  [MESSAGING_KINDS.start]: 30,
  [MESSAGING_KINDS.report]: 20,
  [MESSAGING_KINDS.poll]: 300,
};

const SLOW_DOWN_MESSAGES: Record<MessagingKind, string> = {
  [MESSAGING_KINDS.send]: "You're sending fast. Give it a minute and try again.",
  [MESSAGING_KINDS.start]: "You're opening a lot of conversations. Give it a minute and try again.",
  [MESSAGING_KINDS.report]: "You're sending a lot of reports. Give it a minute and try again.",
  [MESSAGING_KINDS.poll]: "You're checking for messages very often. Give it a minute and try again.",
};

export async function enforceMessagingLimit(database: Database, memberId: string, kind: MessagingKind) {
  await pruneExpiredRateLimits(database);
  const { isLimited } = await recordFailedAttempt(database, `messages-${kind}|${memberId}`, MESSAGING_MAXIMUM_PER_MINUTE[kind]);
  if (isLimited) throw new NetworkRequestError(TOO_MANY_REQUESTS_STATUS, MESSAGE_ERROR_CODES.tooFast, SLOW_DOWN_MESSAGES[kind]);
}
