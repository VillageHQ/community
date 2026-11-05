import "server-only";

import type { z } from "zod";

import { readActiveSession } from "../auth/active-session.ts";
import { isAdminMember } from "../auth/roles.ts";
import { getDatabase, type Database } from "../database/client.ts";
import { withRouteLogging } from "../observability/route-logging.ts";
import { resolveTrustedOrigins } from "./app-url.ts";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "./body-limit.ts";
import { REQUEST_ERROR_CODES } from "./error-codes.ts";
import { readJsonBody } from "./read-json-body.ts";
import { createNetworkContext, type NetworkContext, type SessionMember } from "./request-context.ts";
import { NetworkRequestError } from "./request-error.ts";

const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const UNPROCESSABLE_STATUS = 422;

export type FriendlyError = { status: number; code: string; message: string };

export type ErrorResponder = (database: Database, error: unknown) => Promise<Response | null>;

export function respondWithError({ status, code, message }: FriendlyError) {
  return Response.json({ code, message }, { status });
}

async function respondToKnownError(database: Database, error: unknown, errorResponders: readonly ErrorResponder[]) {
  if (error instanceof NetworkRequestError) {
    return respondWithError({ status: error.status, code: error.code, message: error.message });
  }
  for (const respond of errorResponders) {
    const response = await respond(database, error);
    if (response) return response;
  }
  throw error;
}

export async function readSessionMember(request: Request): Promise<SessionMember | null> {
  const session = await readActiveSession(request.headers);
  return session?.user ?? null;
}

export function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && resolveTrustedOrigins(process.env).includes(origin);
}

type MemberRouteOptions = { adminOnly?: boolean; deadlineMs?: number };

async function readAuthorizedMember(request: Request, adminOnly: boolean) {
  if (!hasTrustedOrigin(request)) {
    return respondWithError({
      status: FORBIDDEN_STATUS,
      code: REQUEST_ERROR_CODES.forbiddenOrigin,
      message: "This request came from another site.",
    });
  }

  const member = await readSessionMember(request);
  if (!member) {
    return respondWithError({
      status: UNAUTHORIZED_STATUS,
      code: REQUEST_ERROR_CODES.unauthenticated,
      message: "Sign in to continue.",
    });
  }
  if (adminOnly && !isAdminMember(member)) {
    return respondWithError({
      status: FORBIDDEN_STATUS,
      code: REQUEST_ERROR_CODES.forbidden,
      message: "Only an admin can do this.",
    });
  }
  return member;
}

type BinaryRouteOptions = { maximumBytes: number; tooLargeMessage: string };
type BinaryResponder = (context: NetworkContext, bytes: Buffer, request: Request) => Promise<Response>;

function createBinaryRoute(scope: string, adminOnly: boolean, options: BinaryRouteOptions, respond: BinaryResponder) {
  const { maximumBytes, tooLargeMessage } = options;
  return withRouteLogging(scope, async (request: Request) => {
    const member = await readAuthorizedMember(request, adminOnly);
    if (member instanceof Response) return member;

    const readBoundedBody = withBodyLimit(
      maximumBytes,
      async (boundedRequest) => {
        const bytes = Buffer.from(await boundedRequest.arrayBuffer());
        return respond(createNetworkContext(getDatabase(), process.env, member), bytes, boundedRequest);
      },
      tooLargeMessage,
    );
    return readBoundedBody(request);
  });
}

export function createMemberRoutes(errorResponders: readonly ErrorResponder[]) {
  return {
    createMemberRoute<Schema extends z.ZodType>(
      scope: string,
      bodySchema: Schema,
      respond: (context: NetworkContext, body: z.infer<Schema>) => Promise<Response>,
      { adminOnly = false, deadlineMs }: MemberRouteOptions = {},
    ) {
      return withRouteLogging(
        scope,
        withBodyLimit(MAXIMUM_JSON_BODY_BYTES, async (request) => {
          const member = await readAuthorizedMember(request, adminOnly);
          if (member instanceof Response) return member;

          const body = bodySchema.safeParse(await readJsonBody(request));
          if (!body.success) {
            return respondWithError({
              status: UNPROCESSABLE_STATUS,
              code: REQUEST_ERROR_CODES.invalidRequest,
              message: body.error.issues[0]?.message ?? "The form is invalid.",
            });
          }

          const context = createNetworkContext(getDatabase(), process.env, member, deadlineMs);
          try {
            return await respond(context, body.data);
          } catch (error) {
            return await respondToKnownError(context.database, error, errorResponders);
          }
        }),
      );
    },
    createAdminBinaryRoute(scope: string, options: BinaryRouteOptions, respond: BinaryResponder) {
      return createBinaryRoute(scope, true, options, respond);
    },
    createMemberBinaryRoute(scope: string, options: BinaryRouteOptions, respond: BinaryResponder) {
      return createBinaryRoute(scope, false, options, respond);
    },
  };
}
