import "server-only";

import { createHash } from "node:crypto";

import { isVillageError, VillageError, type CallOptions, type Village, type VillageRequestEvent } from "@villagehq/sdk";
import { createVillageApp, type VillageApp } from "@villagehq/sdk/server";
import { z } from "zod";

export const VILLAGE_TIMEOUTS_MS = { default: 15_000, paths: 60_000, search: 120_000 } as const;
export const NETWORK_SOURCE = "network";

const MAXIMUM_VILLAGE_APPS = 10;
const BAD_REQUEST_STATUS = 400;
const LEAVE_OPERATION = "groups.leave";
const JSON_CONTENT_TYPE = "json";

const villageApps = new Map<string, VillageApp>();

export type VillageConnection = { apiUrl: string | undefined; secretKey: string; deadlineAtMs: number };
export type VillageIdentity = { externalId: string; email: string };
export type VillageSession = { village: Village; deadlineAtMs: number };

// TODO(@villagehq/sdk): a VillageError doesn't say whether Village wrote the answer or a proxy in front of it did.
// people.paths reads a proxy's HTML 404 as an unknown person, and groups.leave reads it as "not a member".
// Until the SDK tells them apart, any answer that isn't JSON fails here, with no status for the SDK to misread.
export class VillageGatewayError extends VillageError {
  readonly answeredStatus: number;

  constructor(answeredStatus: number) {
    super({ code: "server", message: `Village's address answered ${answeredStatus} with something other than JSON.` });
    this.answeredStatus = answeredStatus;
  }
}

async function fetchVillageJson(request: Request) {
  const response = await fetch(request);
  if (response.headers.get("content-type")?.includes(JSON_CONTENT_TYPE)) return response;
  await response.body?.cancel();
  throw new VillageGatewayError(response.status);
}

// TODO(@villagehq/sdk): groups.leave turns a 400 into the admin_blocked outcome, but onRequest still reports it as an error.
function isLeaveOutcome({ operation, status }: VillageRequestEvent) {
  return operation === LEAVE_OPERATION && status === BAD_REQUEST_STATUS;
}

function logVillageFailure(event: VillageRequestEvent) {
  const { operation, durationMs, requestId, error } = event;
  if (!error || error.isExpected || isLeaveOutcome(event)) return;
  const status = error instanceof VillageGatewayError ? error.answeredStatus : event.status;
  console.error(
    JSON.stringify({ level: "error", scope: "village", operation, status, code: error.code, durationMs, requestId, traceId: error.traceId }),
  );
}

function readVillageApp({ apiUrl, secretKey }: VillageConnection) {
  const key = createHash("sha256").update(`${apiUrl}\n${secretKey}`).digest("hex");
  const cached = villageApps.get(key);
  if (cached) return cached;

  const oldestKey = villageApps.keys().next().value;
  if (villageApps.size >= MAXIMUM_VILLAGE_APPS && oldestKey) villageApps.delete(oldestKey);
  const villageApp = createVillageApp({ secretKey, apiUrl, fetch: fetchVillageJson, onRequest: logVillageFailure });
  villageApps.set(key, villageApp);
  return villageApp;
}

export function createVillageSession(connection: VillageConnection, { externalId, email }: VillageIdentity): VillageSession {
  return { village: readVillageApp(connection).as({ id: externalId, email }), deadlineAtMs: connection.deadlineAtMs };
}

export function withinDeadline({ deadlineAtMs }: Pick<VillageSession, "deadlineAtMs">, usualTimeoutMs: number = VILLAGE_TIMEOUTS_MS.default): CallOptions {
  const remainingMs = deadlineAtMs - Date.now();
  if (remainingMs <= 0) throw new VillageError({ code: "timeout", message: "No time was left to call Village." });
  return { timeoutMs: Math.min(usualTimeoutMs, remainingMs) };
}

export function isVillageErrorResponse(error: unknown): error is VillageError {
  if (!isVillageError(error) || error instanceof VillageGatewayError) return false;
  return error.status !== null && error.status >= BAD_REQUEST_STATUS;
}

export async function mintVillageToken(connection: VillageConnection, { externalId, email }: VillageIdentity) {
  const { token } = await readVillageApp(connection).tokens.create({ id: externalId, email }, withinDeadline(connection));
  return token;
}

export async function readVillageAppPublicKey(session: VillageSession) {
  const { public_key } = await session.village.app.get(withinDeadline(session));
  return public_key;
}

export function readVillageUser(session: VillageSession) {
  return session.village.user.get(withinDeadline(session));
}

export async function createVillageGroup(session: VillageSession, name: string) {
  const { id, invite_link } = await session.village.groups.create(name, withinDeadline(session));
  return { id, inviteLink: invite_link };
}

export function joinVillageGroup(session: VillageSession, inviteLink: string) {
  return session.village.groups.join(inviteLink, withinDeadline(session));
}

export function leaveVillageGroup(session: VillageSession, groupId: string) {
  return session.village.groups.leave(groupId, withinDeadline(session));
}

export const GLOBAL_SOURCE = "global";

// "network" searches the member's network; "global" searches everyone Village knows.
export async function searchVillageNetwork(session: VillageSession, prompt: string, scope: typeof NETWORK_SOURCE | typeof GLOBAL_SOURCE = NETWORK_SOURCE) {
  const { results, response } = await session.village.people.search({ prompt, scope }, withinDeadline(session, VILLAGE_TIMEOUTS_MS.search));
  return { people: results, source: response.metadata.source };
}

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

export async function readVillagePaths(session: VillageSession, linkedinUrl: string) {
  const villagePaths = await session.village.people.paths(linkedinUrl, withinDeadline(session, VILLAGE_TIMEOUTS_MS.paths));
  if (villagePaths === null) return null;
  const parsed = villagePathsSchema.safeParse(villagePaths);
  if (parsed.success) return parsed.data;
  throw new VillageError({ code: "invalid_response", status: 200, message: "Village's paths weren't in the expected shape." });
}

// Profile fill-in runs as one "public" identity of the app, never as a member, so a lookup can't
// create a Village user or touch anyone's network.
const LOOKUP_IDENTITY_ID = "community-profile-fill-in";
const LOOKUP_MODE = "cached_first";

export function createVillageLookupSession(connection: VillageConnection, email: string): VillageSession {
  return { village: readVillageApp(connection).as({ id: LOOKUP_IDENTITY_ID, email, grant: "public" }), deadlineAtMs: connection.deadlineAtMs };
}

const companySchema = z.object({ name: z.string().nullish(), image_url: z.string().nullish() }).nullish();
const workSchema = z.object({ title: z.string().nullish(), company: companySchema }).nullish();

export const villageProfileSchema = z.object({
  linkedin_url: z.string().nullish(),
  avatar: z.string().nullish(),
  headline: z.string().nullish(),
  location: z.object({ city: z.string().nullish(), state: z.string().nullish(), country: z.string().nullish() }).nullish(),
  work_relevant: workSchema,
  work_history: z.array(workSchema).nullish(),
  last_enrichment_at: z.string().nullish(),
});

export type VillageProfile = z.infer<typeof villageProfileSchema>;

function parseVillageProfile(profile: unknown) {
  const parsed = villageProfileSchema.safeParse(profile);
  if (parsed.success) return parsed.data;
  throw new VillageError({ code: "invalid_response", status: 200, message: "Village's profile wasn't in the expected shape." });
}

const ERROR_CODE_BY_STATUS: Record<number, VillageError["code"]> = {
  400: "bad_request",
  401: "unauthorized",
  402: "out_of_credits",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  422: "validation",
  429: "rate_limited",
};

const SERVER_ERROR_STATUS = 500;
const NOT_FOUND_STATUS = 404;
const TIMEOUT_ERROR_NAME = "TimeoutError";

function toLookupError(status: number) {
  const code = ERROR_CODE_BY_STATUS[status] ?? (status >= SERVER_ERROR_STATUS ? "server" : "bad_request");
  return new VillageError({ code, status, message: `Village answered the email lookup with ${status}.` });
}

// TODO(@villagehq/sdk): the SDK has no call for POST /v2/people/enrich/by-email, so this goes through
// its typed client. That keeps the key, the JSON guard and the failure log; Village's 404 means nobody.
export async function readVillageProfileByEmail(session: VillageSession, email: string) {
  const signal = AbortSignal.timeout(withinDeadline(session).timeoutMs ?? VILLAGE_TIMEOUTS_MS.default);
  const { data, response } = await session.village.api
    .POST("/v2/people/enrich/by-email", { body: { email, mode: LOOKUP_MODE }, signal })
    .catch((cause: unknown) => {
      if (isVillageError(cause)) throw cause;
      const isTimeout = cause instanceof Error && cause.name === TIMEOUT_ERROR_NAME;
      throw new VillageError({ code: isTimeout ? "timeout" : "network", message: isTimeout ? "Village took too long to answer." : "Couldn't reach Village.", cause });
    });
  if (response.status === NOT_FOUND_STATUS) return null;
  if (!response.ok || !data) throw toLookupError(response.status);
  return parseVillageProfile(data.data);
}

export async function readVillageProfile(session: VillageSession, linkedinUrl: string) {
  try {
    return parseVillageProfile(await session.village.people.enrich(linkedinUrl, withinDeadline(session)));
  } catch (error) {
    if (isVillageError(error, "not_found")) return null;
    throw error;
  }
}
