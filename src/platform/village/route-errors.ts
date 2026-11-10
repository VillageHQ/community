import "server-only";

import { isVillageError, type VillageErrorCode } from "@villagehq/sdk";

import type { Database } from "../database/client.ts";
import { respondWithError, type FriendlyError } from "../http/member-route.ts";
import { DailyLimitReachedError, MonthlyCapReachedError } from "./credit-ledger.ts";
import { VILLAGE_ERROR_CODES } from "./error-codes.ts";
import { recordVillageOutcome } from "./health.ts";
import { recordVillageOutOfCredits } from "./settings.ts";

const CONFLICT_STATUS = 409;
const TOO_MANY_REQUESTS_STATUS = 429;
const BAD_GATEWAY_STATUS = 502;
const GATEWAY_TIMEOUT_STATUS = 504;

const UNAVAILABLE_ERROR: FriendlyError = {
  status: BAD_GATEWAY_STATUS,
  code: VILLAGE_ERROR_CODES.unavailable,
  message: "Village isn't responding right now. Try again in a moment.",
};

const NOT_LINKED_ERROR: FriendlyError = {
  status: CONFLICT_STATUS,
  code: VILLAGE_ERROR_CODES.notLinked,
  message: "Your Village account isn't linked yet. Sync your network first.",
};

const FRIENDLY_VILLAGE_ERRORS: Partial<Record<VillageErrorCode, FriendlyError>> = {
  unauthorized: {
    status: BAD_GATEWAY_STATUS,
    code: VILLAGE_ERROR_CODES.keysRejected,
    message: "Village rejected this community's keys. Ask an admin to check them.",
  },
  out_of_credits: {
    status: BAD_GATEWAY_STATUS,
    code: VILLAGE_ERROR_CODES.outOfCredits,
    message: "This community has run out of Village credits for now. Your admin can see this and add more. You don't need to do anything.",
  },
  forbidden: NOT_LINKED_ERROR,
  not_connected: NOT_LINKED_ERROR,
  not_found: NOT_LINKED_ERROR,
  not_synced: {
    status: CONFLICT_STATUS,
    code: VILLAGE_ERROR_CODES.notSynced,
    message: "Village is still syncing your network. Try again when it finishes.",
  },
  rate_limited: {
    status: TOO_MANY_REQUESTS_STATUS,
    code: VILLAGE_ERROR_CODES.rateLimited,
    message: "Village is busy. Wait a minute and try again.",
  },
  timeout: {
    status: GATEWAY_TIMEOUT_STATUS,
    code: VILLAGE_ERROR_CODES.timedOut,
    message: "Village took too long to answer. Try again in a moment.",
  },
};

export async function respondToVillageError(database: Database, error: unknown) {
  if (isVillageError(error, "out_of_credits")) await recordVillageOutOfCredits(database);
  // The request hook records this too, but without waiting; here the admin's notice is there before the member's answer.
  if (isVillageError(error)) await recordVillageOutcome(database, error);
  if (isVillageError(error)) return respondWithError(FRIENDLY_VILLAGE_ERRORS[error.code] ?? UNAVAILABLE_ERROR);
  if (error instanceof DailyLimitReachedError) {
    return respondWithError({
      status: TOO_MANY_REQUESTS_STATUS,
      code: VILLAGE_ERROR_CODES.dailyLimitReached,
      message: `You reached today's limit of ${error.limit} Village lookups. Try again tomorrow.`,
    });
  }
  if (error instanceof MonthlyCapReachedError) {
    return respondWithError({
      status: TOO_MANY_REQUESTS_STATUS,
      code: VILLAGE_ERROR_CODES.monthlyCapReached,
      message: "This community has used this month's Village credits. Lookups start again on the 1st, or sooner if an admin raises the cap.",
    });
  }
  return null;
}
