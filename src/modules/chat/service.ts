import "server-only";

import { eq, sql } from "drizzle-orm";

import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { withAdminTransaction } from "@/platform/audit/admin-transaction";
import { recordAdminAction } from "@/platform/audit/record";
import type { Database, DatabaseOrTransaction } from "@/platform/database/client";
import type { Environment } from "@/platform/environment";
import type { RequestContext } from "@/platform/http/request-context";
import { RequestError } from "@/platform/http/request-error";

import { ChatError, createChatClient } from "./client";
import {
  CHAT_ERROR_CODES,
  CHAT_KINDS,
  CHAT_LIMITS,
  type ChatConnectionView,
  type ChatKind,
  type DiscordConnectBody,
  type SlackChannel,
  type SlackConnectBody,
} from "./contract";
import { chatConnection } from "./schema";
import { CHAT_SECRET_FIELDS, openChatSecret, sealChatSecret, UNREADABLE_SECRET_MESSAGE } from "./service-secrets";

const UNPROCESSABLE_STATUS = 422;
const NOT_FOUND_STATUS = 404;

const KIND_NAMES: Record<ChatKind, string> = { [CHAT_KINDS.slack]: "Slack", [CHAT_KINDS.discord]: "Discord" };

export function readChatKindName(kind: ChatKind) {
  return KIND_NAMES[kind];
}

type ConnectionRow = typeof chatConnection.$inferSelect;

function isChatKind(value: string): value is ChatKind {
  return value === CHAT_KINDS.slack || value === CHAT_KINDS.discord;
}

// The last post failed when its error is newer than the last post that went through.
function needsAttention(row: ConnectionRow) {
  if (row.isRefused) return true;
  if (!row.lastErrorAt) return false;
  return !row.lastPostAt || row.lastErrorAt > row.lastPostAt;
}

function toView(row: ConnectionRow): ChatConnectionView | null {
  if (!isChatKind(row.kind)) return null;
  return {
    kind: row.kind,
    accountId: row.accountId,
    accountName: row.accountName,
    channelId: row.channelId,
    channelName: row.channelName,
    isPaused: row.isPaused,
    lastPostAt: row.lastPostAt?.toISOString() ?? null,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt?.toISOString() ?? null,
    needsAttention: needsAttention(row),
    connectedAt: row.connectedAt.toISOString(),
  };
}

export async function readConnectionRow(connection: DatabaseOrTransaction, kind: ChatKind) {
  const [row] = await connection.select().from(chatConnection).where(eq(chatConnection.kind, kind));
  return row ?? null;
}

export async function readChatConnections(database: Database) {
  const rows = await database.select().from(chatConnection);
  return rows.flatMap((row) => {
    const view = toView(row);
    return view ? [view] : [];
  });
}

export async function readChatConnection(database: Database, kind: ChatKind) {
  const row = await readConnectionRow(database, kind);
  return row ? toView(row) : null;
}

export async function readChatSecrets(database: DatabaseOrTransaction, environment: Environment, kind: ChatKind) {
  const row = await readConnectionRow(database, kind);
  if (!row) return null;
  const [token, signingSecret] = await Promise.all([
    openChatSecret(environment, kind, CHAT_SECRET_FIELDS.token, row.token),
    openChatSecret(environment, kind, CHAT_SECRET_FIELDS.signingSecret, row.signingSecret),
  ]);
  return { row, token, signingSecret };
}

export async function recordPosted(connection: DatabaseOrTransaction, kind: ChatKind) {
  await connection
    .update(chatConnection)
    .set({ lastPostAt: sql`now()`, lastError: null, lastErrorAt: null })
    .where(eq(chatConnection.kind, kind));
}

export async function recordFailure(connection: DatabaseOrTransaction, kind: ChatKind, message: string, isRefused = false) {
  await connection
    .update(chatConnection)
    .set({ lastError: message.slice(0, CHAT_LIMITS.errorCharacters), lastErrorAt: sql`now()`, ...(isRefused ? { isRefused: true } : {}) })
    .where(eq(chatConnection.kind, kind));
}

function toRequestError(error: unknown): never {
  if (error instanceof ChatError) throw new RequestError(UNPROCESSABLE_STATUS, CHAT_ERROR_CODES.refused, error.message);
  throw error;
}

function notConnectedError(kind: ChatKind) {
  return new RequestError(NOT_FOUND_STATUS, CHAT_ERROR_CODES.notConnected, `${readChatKindName(kind)} isn't connected. Connect it first.`);
}

type SavedConnection = { kind: ChatKind; token: string; signingSecret: string | null; accountId: string; accountName: string };

// A new token replaces the old one. The channel stays only when it's the same workspace or bot.
async function saveConnection(context: RequestContext, saved: SavedConnection, channel: { id: string; name: string } | null) {
  const { database, environment, member } = context;
  const [sealedToken, sealedSecret] = await Promise.all([
    sealChatSecret(environment, saved.kind, CHAT_SECRET_FIELDS.token, saved.token),
    saved.signingSecret ? sealChatSecret(environment, saved.kind, CHAT_SECRET_FIELDS.signingSecret, saved.signingSecret) : null,
  ]);
  await withAdminTransaction(database, member.id, async (transaction) => {
    const old = await readConnectionRow(transaction, saved.kind);
    const isSameAccount = old !== null && old.accountId === saved.accountId;
    const keptChannel = channel ?? (isSameAccount && old.channelId ? { id: old.channelId, name: old.channelName ?? old.channelId } : null);
    const values = {
      token: sealedToken,
      signingSecret: sealedSecret,
      accountId: saved.accountId,
      accountName: saved.accountName,
      channelId: keptChannel?.id ?? null,
      channelName: keptChannel?.name ?? null,
      isRefused: false,
      lastError: null,
      lastErrorAt: null,
      // Any new token starts posting from now, so a reconnect never posts what came in while it was broken.
      postsFromAt: new Date(),
      ...(old ? {} : { connectedAt: new Date() }),
    };
    await transaction
      .insert(chatConnection)
      .values({ kind: saved.kind, ...values })
      .onConflictDoUpdate({ target: chatConnection.kind, set: values });
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.chatConnected, detail: `${readChatKindName(saved.kind)} (${saved.accountName})` });
  });
}

export async function connectSlack(context: RequestContext, { token, signingSecret }: SlackConnectBody) {
  const client = createChatClient({ environment: context.environment });
  const who = await client.slack.whoami(token).catch(toRequestError);
  await saveConnection(context, { kind: CHAT_KINDS.slack, token, signingSecret, accountId: who.teamId, accountName: who.teamName || who.teamId }, null);
  return { accountName: who.teamName };
}

async function requireSecrets(database: Database, environment: Environment, kind: ChatKind) {
  const secrets = await readChatSecrets(database, environment, kind);
  if (!secrets) throw notConnectedError(kind);
  if (!secrets.token) throw new RequestError(UNPROCESSABLE_STATUS, CHAT_ERROR_CODES.refused, UNREADABLE_SECRET_MESSAGE);
  return { row: secrets.row, token: secrets.token };
}

export async function listSlackChannels(database: Database, environment: Environment): Promise<{ channels: SlackChannel[]; error: string | null }> {
  const secrets = await readChatSecrets(database, environment, CHAT_KINDS.slack);
  if (!secrets) return { channels: [], error: null };
  if (!secrets.token) return { channels: [], error: UNREADABLE_SECRET_MESSAGE };
  try {
    return { channels: await createChatClient({ environment }).slack.listChannels(secrets.token), error: null };
  } catch (error) {
    if (error instanceof ChatError) return { channels: [], error: error.message };
    throw error;
  }
}

export async function chooseSlackChannel(context: RequestContext, channelId: string) {
  const { database, environment, member } = context;
  const { token } = await requireSecrets(database, environment, CHAT_KINDS.slack);
  const channels = await createChatClient({ environment }).slack.listChannels(token).catch(toRequestError);
  const channel = channels.find(({ id }) => id === channelId);
  if (!channel) throw new RequestError(UNPROCESSABLE_STATUS, CHAT_ERROR_CODES.refused, "Pick one of the channels in the list.");
  await withAdminTransaction(database, member.id, async (transaction) => {
    await transaction
      .update(chatConnection)
      .set({ channelId: channel.id, channelName: channel.name, lastError: null, lastErrorAt: null, postsFromAt: sql`now()` })
      .where(eq(chatConnection.kind, CHAT_KINDS.slack));
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.chatChannelChosen, detail: `Slack #${channel.name}` });
  });
  return channel;
}

export async function connectDiscord(context: RequestContext, body: DiscordConnectBody) {
  const { database, environment } = context;
  const saved = body.token ? null : await readChatSecrets(database, environment, CHAT_KINDS.discord);
  const token = body.token || saved?.token;
  if (!token) {
    throw new RequestError(UNPROCESSABLE_STATUS, CHAT_ERROR_CODES.refused, saved ? UNREADABLE_SECRET_MESSAGE : "Paste the bot token from your Discord application's Bot page.");
  }
  const client = createChatClient({ environment });
  const who = await client.discord.whoami(token).catch(toRequestError);
  const channel = await client.discord.readChannel(token, body.channelId).catch(toRequestError);
  await saveConnection(context, { kind: CHAT_KINDS.discord, token, signingSecret: null, accountId: who.botId, accountName: who.botName || who.botId }, channel);
  return { botName: who.botName, channelName: channel.name };
}

// One post straight to one tool, outside the ledger. The test post and the item posts both end here.
export async function sendToChannel(database: Database, environment: Environment, kind: ChatKind, text: string) {
  const secrets = await readChatSecrets(database, environment, kind);
  if (!secrets) return { error: `${readChatKindName(kind)} isn't connected.`, isRefused: false };
  const { row, token } = secrets;
  if (!row.channelId) {
    const error = "Pick a channel first.";
    await recordFailure(database, kind, error);
    return { error, isRefused: false };
  }
  if (!token) {
    await recordFailure(database, kind, UNREADABLE_SECRET_MESSAGE, true);
    return { error: UNREADABLE_SECRET_MESSAGE, isRefused: true };
  }
  const client = createChatClient({ environment });
  try {
    await (kind === CHAT_KINDS.slack ? client.slack.post(token, row.channelId, text) : client.discord.post(token, row.channelId, text));
    await recordPosted(database, kind);
    return { error: null, isRefused: false };
  } catch (error) {
    if (!(error instanceof ChatError)) throw error;
    await recordFailure(database, kind, error.message, error.isTokenRefused);
    return { error: error.message, isRefused: error.isTokenRefused };
  }
}

export async function sendTestPost(context: RequestContext, kind: ChatKind, text: string) {
  const outcome = await sendToChannel(context.database, context.environment, kind, text);
  if (outcome.error) throw new RequestError(UNPROCESSABLE_STATUS, CHAT_ERROR_CODES.refused, outcome.error);
}

export async function setChatPaused(context: RequestContext, kind: ChatKind, isPaused: boolean) {
  const { database, member } = context;
  await withAdminTransaction(database, member.id, async (transaction) => {
    const updated = await transaction.update(chatConnection).set(isPaused ? { isPaused } : { isPaused, postsFromAt: sql`now()` }).where(eq(chatConnection.kind, kind)).returning({ kind: chatConnection.kind });
    if (updated.length === 0) throw notConnectedError(kind);
    await recordAdminAction(transaction, member.id, { action: isPaused ? AUDIT_ACTIONS.chatPaused : AUDIT_ACTIONS.chatResumed, detail: readChatKindName(kind) });
  });
}

// Deletes the tokens and what was posted. Nothing is left to read them back.
export async function disconnectChat(context: RequestContext, kind: ChatKind) {
  const { database, member } = context;
  await withAdminTransaction(database, member.id, async (transaction) => {
    const removed = await transaction.delete(chatConnection).where(eq(chatConnection.kind, kind)).returning({ kind: chatConnection.kind });
    if (removed.length === 0) throw notConnectedError(kind);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.chatDisconnected, detail: readChatKindName(kind) });
  });
}
