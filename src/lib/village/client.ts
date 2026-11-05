import "server-only";

import { z } from "zod";

import { dropReusableToken, withReusableToken } from "./reusable-tokens.ts";

const DEFAULT_TIMEOUT_MS = 15_000;
const PATHS_TIMEOUT_MS = 60_000;
const SEARCH_TIMEOUT_MS = 120_000;
const BAD_REQUEST_STATUS = 400;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNREACHABLE_STATUS = 503;
const TIMED_OUT_STATUS = 504;
const UNREACHABLE_TYPE = "unreachable";
const TIMEOUT_ERROR_NAME = "TimeoutError";
const NO_STATUSES: readonly number[] = [];

export const VILLAGE_FAILURE_TYPES = {
  timedOut: "timed_out",
  invalidResponse: "invalid_response",
  unreadableError: "unreadable_error",
} as const;

export const NETWORK_NOT_SYNCED_TYPE = "network_not_synced";
export const NETWORK_SOURCE = "network";
export const VILLAGE_NOT_FOUND_STATUS = NOT_FOUND_STATUS;
export const VILLAGE_UNAUTHORIZED_STATUS = UNAUTHORIZED_STATUS;
export const VILLAGE_LEAVE_OUTCOMES = {
  left: "left",
  notMember: "not_member",
  adminBlocked: "admin_blocked",
} as const;

export class VillageApiError extends Error {
  readonly status: number;
  readonly type: string;
  readonly isVillageErrorResponse: boolean;

  constructor(status: number, type: string, isVillageErrorResponse = false) {
    super(`Village responded ${status} (${type}).`);
    this.status = status;
    this.type = type;
    this.isVillageErrorResponse = isVillageErrorResponse;
  }
}

export function isVillageErrorStatus(error: unknown, status: number) {
  return error instanceof VillageApiError && error.isVillageErrorResponse && error.status === status;
}

type VillageTarget = { apiUrl: string; deadlineAtMs: number };
type VillageConnection = VillageTarget & { secretKey: string };
type VillageIdentity = { externalId: string; email: string };

export type VillageSession = {
  target: VillageTarget;
  withToken: <Result>(call: (token: string) => Promise<Result>) => Promise<Result>;
};

type VillageRequest<Schema extends z.ZodType> = {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  schema: Schema;
  headers?: Record<string, string>;
  timeoutMs?: number;
  expectedErrorStatuses?: readonly number[];
};

const errorBodySchema = z.object({
  error: z.object({ type: z.string(), trace_id: z.string().optional() }),
});

const tokenBodySchema = z.object({ data: z.object({ token: z.string() }) });
const appBodySchema = z.object({ data: z.object({ public_key: z.string() }) });
const userBodySchema = z.object({
  data: z.object({ email: z.string(), is_sync_complete: z.boolean() }),
});
const groupBodySchema = z.object({ data: z.object({ id: z.string(), invite_link: z.string() }) });
const ignoredBodySchema = z.unknown();

const searchBodySchema = z.object({
  data: z.array(
    z.object({
      first_name: z.string().nullish(),
      last_name: z.string().nullish(),
      full_name: z.string().nullish(),
      linkedin_url: z.string().nullish(),
      headline: z.string().nullish(),
    }),
  ),
  metadata: z.object({ source: z.string().optional() }).optional(),
});

const pathProfileSchema = z.object({
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  linkedin_url: z.string().nullish(),
  headline: z.string().nullish(),
});

const scoreMetaSchema = z.array(z.object({ title: z.string().nullish(), description: z.string().nullish() })).nullish();

const pathTargetSchema = z.object({
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  full_name: z.string().nullish(),
  headline: z.string().nullish(),
});

const pathSummarySchema = z.object({
  score_label: z.string().nullish(),
  description: z.string().nullish(),
});

export const villagePathsSchema = z.object({
  person: pathTargetSchema.nullish(),
  summary: pathSummarySchema.nullish(),
  paths: z.array(
    z.object({
      degree: z.number(),
      summary: pathSummarySchema,
      starters: z.array(
        z.object({ profile: pathProfileSchema, is_current_user: z.boolean().nullish(), score_meta: scoreMetaSchema }),
      ),
      introducer: z.object({ profile: pathProfileSchema, score_meta: scoreMetaSchema }).nullish(),
    }),
  ),
});

export type VillagePaths = z.infer<typeof villagePathsSchema>;

const pathsBodySchema = z.object({ data: villagePathsSchema });

async function readVillageError(response: Response) {
  const parsed = errorBodySchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return { type: VILLAGE_FAILURE_TYPES.unreadableError, isVillageError: false };
  }
  return {
    type: parsed.data.error.type,
    traceId: parsed.data.error.trace_id,
    isVillageError: true,
  };
}

function logVillageFailure(path: string, status: number, type: string, traceId?: string) {
  console.error(JSON.stringify({ level: "error", scope: "village", path, status, type, traceId }));
}

function throwTimedOut(path: string): never {
  logVillageFailure(path, TIMED_OUT_STATUS, VILLAGE_FAILURE_TYPES.timedOut);
  throw new VillageApiError(TIMED_OUT_STATUS, VILLAGE_FAILURE_TYPES.timedOut);
}

async function fetchVillage({ apiUrl, deadlineAtMs }: VillageTarget, request: VillageRequest<z.ZodType>) {
  const remainingMs = deadlineAtMs - Date.now();
  if (remainingMs <= 0) throwTimedOut(request.path);

  try {
    return await fetch(`${apiUrl}${request.path}`, {
      method: request.method,
      headers: { "Content-Type": "application/json", ...request.headers },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: AbortSignal.timeout(Math.min(request.timeoutMs ?? DEFAULT_TIMEOUT_MS, remainingMs)),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === TIMEOUT_ERROR_NAME) throwTimedOut(request.path);
    logVillageFailure(request.path, UNREACHABLE_STATUS, UNREACHABLE_TYPE);
    throw new VillageApiError(UNREACHABLE_STATUS, UNREACHABLE_TYPE);
  }
}

async function requestVillage<Schema extends z.ZodType>(
  target: VillageTarget,
  request: VillageRequest<Schema>,
): Promise<z.infer<Schema>> {
  const response = await fetchVillage(target, request);

  if (!response.ok) {
    const { type, traceId, isVillageError } = await readVillageError(response);
    const expectedStatuses = request.expectedErrorStatuses ?? NO_STATUSES;
    if (!expectedStatuses.includes(response.status)) {
      logVillageFailure(request.path, response.status, type, traceId);
    }
    throw new VillageApiError(
      response.status,
      type,
      isVillageError && response.status >= BAD_REQUEST_STATUS,
    );
  }

  const parsed = request.schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    logVillageFailure(request.path, response.status, VILLAGE_FAILURE_TYPES.invalidResponse);
    throw new VillageApiError(UNREACHABLE_STATUS, VILLAGE_FAILURE_TYPES.invalidResponse);
  }
  return parsed.data;
}

async function mintVillageToken(connection: VillageConnection, identity: VillageIdentity) {
  const { data } = await requestVillage(connection, {
    path: "/v2/auth/tokens",
    method: "POST",
    headers: { "secret-key": connection.secretKey },
    body: { external_user_id: identity.externalId, email: identity.email },
    schema: tokenBodySchema,
  });
  return data.token;
}

export function createVillageSession(
  connection: VillageConnection,
  identity: VillageIdentity,
): VillageSession {
  const identityParts = [
    connection.apiUrl,
    connection.secretKey,
    identity.externalId,
    identity.email,
  ];
  const readToken = () =>
    withReusableToken(identityParts, () => mintVillageToken(connection, identity));

  return {
    target: { apiUrl: connection.apiUrl, deadlineAtMs: connection.deadlineAtMs },
    withToken: async (call) => {
      const token = await readToken();
      try {
        return await call(token);
      } catch (error) {
        if (!isVillageErrorStatus(error, UNAUTHORIZED_STATUS)) throw error;
        dropReusableToken(identityParts);
        return call(await readToken());
      }
    },
  };
}

function requestAsMember<Schema extends z.ZodType>(
  session: VillageSession,
  request: VillageRequest<Schema>,
) {
  return session.withToken((token) =>
    requestVillage(session.target, {
      ...request,
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}

export async function readVillageAppPublicKey(session: VillageSession) {
  const { data } = await requestAsMember(session, {
    path: "/v2/app",
    method: "GET",
    schema: appBodySchema,
  });
  return data.public_key;
}

export async function readVillageUser(session: VillageSession) {
  try {
    const { data } = await requestAsMember(session, {
      path: "/v2/user/me",
      method: "GET",
      schema: userBodySchema,
      expectedErrorStatuses: [NOT_FOUND_STATUS],
    });
    return { email: data.email, isSyncComplete: data.is_sync_complete };
  } catch (error) {
    if (isVillageErrorStatus(error, NOT_FOUND_STATUS)) return null;
    throw error;
  }
}

export async function createVillageGroup(session: VillageSession, name: string) {
  const { data } = await requestAsMember(session, {
    path: "/v2/groups",
    method: "POST",
    body: { name },
    schema: groupBodySchema,
  });
  return { id: data.id, inviteLink: data.invite_link };
}

export async function joinVillageGroup(session: VillageSession, inviteLink: string) {
  try {
    await requestAsMember(session, {
      path: "/v2/groups/join",
      method: "POST",
      body: { group_invite_link: inviteLink },
      schema: ignoredBodySchema,
      expectedErrorStatuses: [CONFLICT_STATUS],
    });
  } catch (error) {
    if (isVillageErrorStatus(error, CONFLICT_STATUS)) return;
    throw error;
  }
}

export async function searchVillageNetwork(session: VillageSession, prompt: string) {
  const { data, metadata } = await requestAsMember(session, {
    path: "/v2/people/search",
    method: "POST",
    body: { prompt, scope: "network" },
    schema: searchBodySchema,
    timeoutMs: SEARCH_TIMEOUT_MS,
  });
  return { people: data, source: metadata?.source };
}

export async function readVillagePaths(session: VillageSession, linkedinUrl: string) {
  const { data } = await requestAsMember(session, {
    path: "/v2/people/paths",
    method: "POST",
    body: { linkedin_url: linkedinUrl },
    schema: pathsBodySchema,
    timeoutMs: PATHS_TIMEOUT_MS,
    expectedErrorStatuses: [NOT_FOUND_STATUS, CONFLICT_STATUS],
  });
  return data;
}

export async function leaveVillageGroup(session: VillageSession, groupId: string) {
  try {
    await requestAsMember(session, {
      path: "/v2/groups/leave",
      method: "POST",
      body: { group_id: groupId },
      schema: ignoredBodySchema,
      expectedErrorStatuses: [BAD_REQUEST_STATUS, NOT_FOUND_STATUS],
    });
    return VILLAGE_LEAVE_OUTCOMES.left;
  } catch (error) {
    if (isVillageErrorStatus(error, NOT_FOUND_STATUS)) return VILLAGE_LEAVE_OUTCOMES.notMember;
    if (isVillageErrorStatus(error, BAD_REQUEST_STATUS)) return VILLAGE_LEAVE_OUTCOMES.adminBlocked;
    throw error;
  }
}
