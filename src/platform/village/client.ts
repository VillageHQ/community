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

export async function searchVillageNetwork(session: VillageSession, prompt: string) {
  const { results, response } = await session.village.people.search(prompt, withinDeadline(session, VILLAGE_TIMEOUTS_MS.search));
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
