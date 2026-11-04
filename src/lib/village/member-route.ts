import "server-only";

import type { z } from "zod";

import { getDatabase } from "../../database/client.ts";
import { resolveTrustedOrigins } from "../app-url.ts";
import { getAuth } from "../auth.ts";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "../body-limit.ts";
import { readJsonBody } from "../read-json-body.ts";
import { withRouteLogging } from "../route-logging.ts";
import { NETWORK_NOT_SYNCED_TYPE, VILLAGE_FAILURE_TYPES, VillageApiError } from "./client.ts";
import { DAILY_CREDIT_CALL_LIMIT, DailyLimitReachedError } from "./daily-usage.ts";
import {
  createNetworkContext,
  isAdminMember,
  NetworkRequestError,
  type NetworkContext,
  type SessionMember,
} from "./member-network.ts";
import { NETWORK_ERROR_CODES } from "./network-api.ts";

const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const TOO_MANY_REQUESTS_STATUS = 429;
const BAD_GATEWAY_STATUS = 502;
const GATEWAY_TIMEOUT_STATUS = 504;

type FriendlyError = { status: number; code: string; message: string };

const UNAVAILABLE_ERROR: FriendlyError = {
  status: BAD_GATEWAY_STATUS,
  code: NETWORK_ERROR_CODES.unavailable,
  message: "Village isn't responding right now. Try again in a moment.",
};

const FRIENDLY_VILLAGE_ERRORS: Record<number, FriendlyError> = {
  401: {
    status: BAD_GATEWAY_STATUS,
    code: NETWORK_ERROR_CODES.keysRejected,
    message: "Village rejected this community's keys. Ask an admin to check them.",
  },
  402: {
    status: BAD_GATEWAY_STATUS,
    code: NETWORK_ERROR_CODES.outOfCredits,
    message: "This community is out of Village credits. Ask an admin to top up.",
  },
  403: {
    status: CONFLICT_STATUS,
    code: NETWORK_ERROR_CODES.notLinked,
    message: "Your Village account isn't linked yet. Sync your network first.",
  },
  404: {
    status: CONFLICT_STATUS,
    code: NETWORK_ERROR_CODES.notLinked,
    message: "Your Village account isn't linked yet. Sync your network first.",
  },
  429: {
    status: TOO_MANY_REQUESTS_STATUS,
    code: NETWORK_ERROR_CODES.rateLimited,
    message: "Village is busy. Wait a minute and try again.",
  },
};

const TIMED_OUT_ERROR: FriendlyError = {
  status: GATEWAY_TIMEOUT_STATUS,
  code: NETWORK_ERROR_CODES.timedOut,
  message: "Village took too long to answer. Try again in a moment.",
};

const NOT_SYNCED_ERROR: FriendlyError = {
  status: CONFLICT_STATUS,
  code: NETWORK_ERROR_CODES.notSynced,
  message: "Village is still syncing your network. Try again when it finishes.",
};

function respondWithError({ status, code, message }: FriendlyError) {
  return Response.json({ code, message }, { status });
}

function toFriendlyVillageError(error: VillageApiError) {
  if (error.type === VILLAGE_FAILURE_TYPES.timedOut) return TIMED_OUT_ERROR;
  if (!error.isVillageErrorResponse) return UNAVAILABLE_ERROR;
  if (error.type === NETWORK_NOT_SYNCED_TYPE) return NOT_SYNCED_ERROR;
  return FRIENDLY_VILLAGE_ERRORS[error.status] ?? UNAVAILABLE_ERROR;
}

function respondToKnownError(error: unknown) {
  if (error instanceof NetworkRequestError) {
    return respondWithError({ status: error.status, code: error.code, message: error.message });
  }
  if (error instanceof VillageApiError) return respondWithError(toFriendlyVillageError(error));
  if (error instanceof DailyLimitReachedError) {
    return respondWithError({
      status: TOO_MANY_REQUESTS_STATUS,
      code: NETWORK_ERROR_CODES.dailyLimitReached,
      message: `You reached today's limit of ${DAILY_CREDIT_CALL_LIMIT} Village lookups. Try again tomorrow.`,
    });
  }
  throw error;
}

async function readSessionMember(request: Request): Promise<SessionMember | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && resolveTrustedOrigins(process.env).includes(origin);
}

type MemberRouteOptions = { adminOnly?: boolean; deadlineMs?: number };

export function createMemberRoute<Schema extends z.ZodType>(
  scope: string,
  bodySchema: Schema,
  respond: (context: NetworkContext, body: z.infer<Schema>) => Promise<Response>,
  { adminOnly = false, deadlineMs }: MemberRouteOptions = {},
) {
  return withRouteLogging(
    scope,
    withBodyLimit(MAXIMUM_JSON_BODY_BYTES, async (request) => {
      if (!hasTrustedOrigin(request)) {
        return respondWithError({
          status: FORBIDDEN_STATUS,
          code: NETWORK_ERROR_CODES.forbiddenOrigin,
          message: "This request came from another site.",
        });
      }

      const member = await readSessionMember(request);
      if (!member) {
        return respondWithError({
          status: UNAUTHORIZED_STATUS,
          code: NETWORK_ERROR_CODES.unauthenticated,
          message: "Sign in to continue.",
        });
      }
      if (adminOnly && !isAdminMember(member)) {
        return respondWithError({
          status: FORBIDDEN_STATUS,
          code: NETWORK_ERROR_CODES.forbidden,
          message: "Only an admin can do this.",
        });
      }

      const body = bodySchema.safeParse(await readJsonBody(request));
      if (!body.success) {
        return respondWithError({
          status: UNPROCESSABLE_STATUS,
          code: NETWORK_ERROR_CODES.invalidRequest,
          message: body.error.issues[0]?.message ?? "The form is invalid.",
        });
      }

      const context = createNetworkContext(getDatabase(), process.env, member, deadlineMs);
      try {
        return await respond(context, body.data);
      } catch (error) {
        return respondToKnownError(error);
      }
    }),
  );
}
