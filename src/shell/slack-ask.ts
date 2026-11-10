import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { ASK_CATEGORIES, ASK_KINDS, ASK_LIMITS, ASKS_PAGE, type CreateAskBody } from "@/modules/asks/contract";
import { ASK_POSTING_KINDS, enforceAskPostingLimit } from "@/modules/asks/limits";
import { asksManifest } from "@/modules/asks/manifest";
import { createAsk } from "@/modules/asks/service";
import { routeAskToHelpers } from "@/modules/asks/service-helpers";
import { ChatError, createChatClient } from "@/modules/chat/client";
import { CHAT_KINDS, CHAT_LIMITS } from "@/modules/chat/contract";
import { clipText, isSlackSignatureValid } from "@/modules/chat/rules";
import { readChatSecrets } from "@/modules/chat/service";
import { isActiveMember } from "@/platform/auth/member-status";
import { readBranding } from "@/platform/branding/branding";
import { user } from "@/platform/database/auth-schema";
import type { Database } from "@/platform/database/client";
import type { Environment } from "@/platform/environment";
import { resolveAppUrl } from "@/platform/http/app-url";
import { readRateLimitClientKey } from "@/platform/http/client-ip";
import { createRequestContext } from "@/platform/http/request-context";
import { RequestError } from "@/platform/http/request-error";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { logError } from "@/platform/observability/route-logging";
import { recordFailedAttempt } from "@/platform/rate-limit/attempt-rate-limit";

import { assertAskAllowance, findAskPaths } from "./ask-helpers";

const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const PAYLOAD_TOO_LARGE_STATUS = 413;
const TOO_MANY_REQUESTS_STATUS = 429;
const BAD_SIGNATURE_LIMIT = 10;
const RATE_LIMIT_PREFIX = "slack-command:";

function plainAnswer(status: number, text: string) {
  return new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

// Slack shows this only to the member who typed the command.
function slackAnswer(text: string) {
  return Response.json({ response_type: "ephemeral", text });
}

async function readBodyWithin(request: Request, maximumBytes: number) {
  if (Number(request.headers.get("content-length") ?? 0) > maximumBytes) return null;
  const body = await request.text();
  return Buffer.byteLength(body) > maximumBytes ? null : body;
}

// Only a verified email that belongs to an active member counts. Slack's address must match it exactly.
async function findMemberByEmail(database: Database, email: string) {
  if (!email) return null;
  const [member] = await database
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
    .where(and(sql`lower(${user.email}) = ${email.toLowerCase()}`, eq(user.emailVerified, true), isActiveMember()));
  return member ?? null;
}

// Slack's line becomes the ask's title. A longer one keeps its start as the title and the whole line as the detail.
export function toSlackAskBody(words: string): CreateAskBody {
  const flat = clipText(words, ASK_LIMITS.detailLength);
  const isLong = flat.length > ASK_LIMITS.titleLength;
  return {
    title: isLong ? clipText(flat, ASK_LIMITS.titleLength) : flat,
    detail: isLong ? flat : null,
    category: ASK_CATEGORIES.other,
    kind: ASK_KINDS.ask,
    targetLinkedin: null,
  };
}

type SlackCommand = { teamId: string; userId: string; text: string };

function readCommand(body: string): SlackCommand {
  const form = new URLSearchParams(body);
  return { teamId: form.get("team_id") ?? "", userId: form.get("user_id") ?? "", text: (form.get("text") ?? "").trim() };
}

// The ask is already saved, so a failure finding helpers must not look like a failed post.
async function routeSafely(...routeArguments: Parameters<typeof routeAskToHelpers>) {
  try {
    await routeAskToHelpers(...routeArguments);
  } catch (error) {
    logError("slack-ask-helper-routing", error);
  }
}

type AnswerFacts = { database: Database; environment: Environment; token: string; accountId: string | null; isPaused: boolean };

async function answerCommand({ database, environment, token, accountId, isPaused }: AnswerFacts, command: SlackCommand) {
  const community = (await readBranding(database)).name;
  const appUrl = resolveAppUrl(environment);
  if (accountId && command.teamId && command.teamId !== accountId) return "This app is connected to another Slack workspace.";
  if (isPaused) return `${community} has paused its Slack app. Post your ask in the app: ${appUrl}${ASKS_PAGE}`;
  if (!(await isModuleEnabled(database, asksManifest))) return `${community} has turned off asks, so there's nowhere to post this.`;
  if (!command.text) return "Write your ask after the command, in one line: /ask an intro to a hospital buyer in the US";

  let email: string;
  try {
    email = await createChatClient({ environment }).slack.readUserEmail(token, command.userId);
  } catch (error) {
    if (!(error instanceof ChatError)) throw error;
    return `Couldn't check who you are in Slack: ${error.message}`;
  }
  const member = await findMemberByEmail(database, email);
  if (!member) {
    return `Join ${community} first, with the same email as your Slack account: <${appUrl}|sign in>, then try /ask again.`;
  }

  const context = createRequestContext(database, environment, member);
  try {
    await enforceAskPostingLimit(database, member.id, ASK_POSTING_KINDS.ask);
    const { id } = await createAsk(context, toSlackAskBody(command.text), assertAskAllowance);
    await routeSafely(context, id, findAskPaths);
  } catch (error) {
    if (error instanceof RequestError) return error.message;
    throw error;
  }
  return `Posted to ${community}. <${appUrl}${ASKS_PAGE}|See the asks>`;
}

// Slack's /ask. No session: the request's signature, made with the app's signing secret, says it's Slack.
export async function answerSlackCommand(database: Database, environment: Environment, request: Request) {
  const secrets = await readChatSecrets(database, environment, CHAT_KINDS.slack);
  if (!secrets?.signingSecret || !secrets.token) return plainAnswer(NOT_FOUND_STATUS, "Slack isn't connected here.");

  const body = await readBodyWithin(request, CHAT_LIMITS.commandBodyBytes);
  if (body === null) return plainAnswer(PAYLOAD_TOO_LARGE_STATUS, "Too large.");

  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  if (!isSlackSignatureValid(secrets.signingSecret, timestamp, signature, body)) {
    const { isLimited } = await recordFailedAttempt(database, `${RATE_LIMIT_PREFIX}${readRateLimitClientKey(request, environment)}`, BAD_SIGNATURE_LIMIT);
    if (isLimited) return plainAnswer(TOO_MANY_REQUESTS_STATUS, "Too many tries. Wait a minute.");
    return plainAnswer(UNAUTHORIZED_STATUS, "The signature is missing, wrong or too old.");
  }

  const facts = { database, environment, token: secrets.token, accountId: secrets.row.accountId, isPaused: secrets.row.isPaused };
  return slackAnswer(await answerCommand(facts, readCommand(body)));
}
