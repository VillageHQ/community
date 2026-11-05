import "server-only";

import type { Database } from "../database/client.ts";
import { respondWithError, type FriendlyError } from "../http/member-route.ts";
import { isVillageErrorStatus, NETWORK_NOT_SYNCED_TYPE, VILLAGE_FAILURE_TYPES, VillageApiError } from "./client.ts";
import { DailyLimitReachedError } from "./credit-ledger.ts";
import { VILLAGE_ERROR_CODES } from "./error-codes.ts";
import { recordVillageOutOfCredits } from "./settings.ts";

const PAYMENT_REQUIRED_STATUS = 402;
const CONFLICT_STATUS = 409;
const TOO_MANY_REQUESTS_STATUS = 429;
const BAD_GATEWAY_STATUS = 502;
const GATEWAY_TIMEOUT_STATUS = 504;

const UNAVAILABLE_ERROR: FriendlyError = {
  status: BAD_GATEWAY_STATUS,
  code: VILLAGE_ERROR_CODES.unavailable,
  message: "Village isn't responding right now. Try again in a moment.",
};

const FRIENDLY_VILLAGE_ERRORS: Record<number, FriendlyError> = {
  401: {
    status: BAD_GATEWAY_STATUS,
    code: VILLAGE_ERROR_CODES.keysRejected,
    message: "Village rejected this community's keys. Ask an admin to check them.",
  },
  [PAYMENT_REQUIRED_STATUS]: {
    status: BAD_GATEWAY_STATUS,
    code: VILLAGE_ERROR_CODES.outOfCredits,
    message: "This community has run out of Village credits for now. Your admin can see this and add more. You don't need to do anything.",
  },
  403: {
    status: CONFLICT_STATUS,
    code: VILLAGE_ERROR_CODES.notLinked,
    message: "Your Village account isn't linked yet. Sync your network first.",
  },
  404: {
    status: CONFLICT_STATUS,
    code: VILLAGE_ERROR_CODES.notLinked,
    message: "Your Village account isn't linked yet. Sync your network first.",
  },
  429: {
    status: TOO_MANY_REQUESTS_STATUS,
    code: VILLAGE_ERROR_CODES.rateLimited,
    message: "Village is busy. Wait a minute and try again.",
  },
};

const TIMED_OUT_ERROR: FriendlyError = {
  status: GATEWAY_TIMEOUT_STATUS,
  code: VILLAGE_ERROR_CODES.timedOut,
  message: "Village took too long to answer. Try again in a moment.",
};

const NOT_SYNCED_ERROR: FriendlyError = {
  status: CONFLICT_STATUS,
  code: VILLAGE_ERROR_CODES.notSynced,
  message: "Village is still syncing your network. Try again when it finishes.",
};

function toFriendlyVillageError(error: VillageApiError) {
  if (error.type === VILLAGE_FAILURE_TYPES.timedOut) return TIMED_OUT_ERROR;
  if (!error.isVillageErrorResponse) return UNAVAILABLE_ERROR;
  if (error.type === NETWORK_NOT_SYNCED_TYPE) return NOT_SYNCED_ERROR;
  return FRIENDLY_VILLAGE_ERRORS[error.status] ?? UNAVAILABLE_ERROR;
}

export async function respondToVillageError(database: Database, error: unknown) {
  if (isVillageErrorStatus(error, PAYMENT_REQUIRED_STATUS)) await recordVillageOutOfCredits(database);
  if (error instanceof VillageApiError) return respondWithError(toFriendlyVillageError(error));
  if (error instanceof DailyLimitReachedError) {
    return respondWithError({
      status: TOO_MANY_REQUESTS_STATUS,
      code: VILLAGE_ERROR_CODES.dailyLimitReached,
      message: `You reached today's limit of ${error.limit} Village lookups. Try again tomorrow.`,
    });
  }
  return null;
}
