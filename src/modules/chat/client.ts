import "server-only";

import type { Environment } from "@/platform/environment";

import type { SlackChannel } from "./contract";

// The only place that talks to Slack and Discord: Slack's Web API (auth.test, conversations.list, users.info,
// chat.postMessage) and Discord's REST API (users/@me, channels/{id}, channels/{id}/messages), with a bot token and
// no gateway. A 429 waits as long as the service asks (capped) and tries again; a 5xx or a network error tries again
// after a short pause; anything else fails at once with words an admin can act on. Tokens are never logged.
//   SLACK_API_BASE   (default https://slack.com/api)         tests point both at src/test/fake-chat-server.ts
//   DISCORD_API_BASE (default https://discord.com/api/v10)

const TRIES = 3;
const MAXIMUM_WAIT_SECONDS = 30;
const REQUEST_TIMEOUT_MS = 10_000;
const RATE_LIMITED_STATUS = 429;
const SERVER_ERROR_STATUS = 500;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CLIENT_ERROR_STATUS = 400;
const SLACK_CHANNEL_PAGES = 5;

// The codes that mean the token itself no longer works. Posting stops until the admin pastes a new one.
const REFUSED_TOKEN_CODES = new Set(["invalid_auth", "not_authed", "token_revoked", "account_inactive", "unauthorized"]);

export class ChatError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
  get isTokenRefused() {
    return REFUSED_TOKEN_CODES.has(this.code);
  }
}

const SLACK_WORDS: Record<string, string> = {
  invalid_auth: "Slack refused the bot token. Paste the Bot User OAuth Token (xoxb-…) from your Slack app's OAuth & Permissions page.",
  not_authed: "Slack refused the bot token. Paste the Bot User OAuth Token (xoxb-…) from your Slack app's OAuth & Permissions page.",
  token_revoked: "The bot token was revoked in Slack. Reinstall the app and paste the new token.",
  account_inactive: "The Slack app was removed from the workspace. Reinstall it and paste the new token.",
  channel_not_found: "Slack can't find that channel. Pick it again.",
  not_in_channel: "The bot isn't in that channel yet. In Slack, type /invite and the bot's name in the channel, then send a test post.",
  is_archived: "That channel is archived in Slack. Pick another one.",
  missing_scope: "The Slack app is missing a permission. Create it again from the manifest on this page and reinstall it.",
  user_not_found: "Slack can't find that user.",
};

type Waiter = (milliseconds: number) => Promise<void>;
type Fetcher = typeof fetch;

export type ChatClientOptions = { environment: Environment; fetcher?: Fetcher; wait?: Waiter };

const waitFor: Waiter = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function readBase(value: string | undefined, fallback: string) {
  return (value || fallback).replace(/\/+$/, "");
}

function readJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: unknown, key: string) {
  if (!isRecord(record)) return "";
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function describeNetworkError(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError") return "no answer in 10 seconds";
  if (error instanceof Error && isRecord(error.cause) && typeof error.cause.code === "string") return error.cause.code;
  return error instanceof Error ? error.message : "no answer";
}

type Answer = { status: number; json: unknown };
type RetryAfterReader = (response: Response, json: unknown) => number;

export function createChatClient({ environment, fetcher = fetch, wait = waitFor }: ChatClientOptions) {
  const slackBase = readBase(environment.SLACK_API_BASE, "https://slack.com/api");
  const discordBase = readBase(environment.DISCORD_API_BASE, "https://discord.com/api/v10");

  async function call(service: string, url: string, init: RequestInit, readRetryAfter: RetryAfterReader): Promise<Answer> {
    let last: ChatError | null = null;
    for (let attempt = 1; attempt <= TRIES; attempt += 1) {
      let response: Response;
      try {
        response = await fetcher(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      } catch (error) {
        last = new ChatError(`Couldn't reach ${service} (${describeNetworkError(error)}).`, "network");
        if (attempt < TRIES) await wait(1000 * attempt);
        continue;
      }
      const json = readJson(await response.text());
      if (response.status === RATE_LIMITED_STATUS) {
        const seconds = Math.min(Math.max(readRetryAfter(response, json) || 1, 0), MAXIMUM_WAIT_SECONDS);
        last = new ChatError(`${service} asked us to slow down, so the post wasn't sent. It's tried again in a minute.`, "rate_limited", RATE_LIMITED_STATUS);
        if (attempt < TRIES) await wait(seconds * 1000);
        continue;
      }
      if (response.status >= SERVER_ERROR_STATUS) {
        last = new ChatError(`${service} had a problem on its side (${response.status}). It's tried again in a minute.`, "server", response.status);
        if (attempt < TRIES) await wait(1000 * attempt);
        continue;
      }
      return { status: response.status, json };
    }
    throw last ?? new ChatError(`Couldn't reach ${service}.`, "network");
  }

  const readSlackRetryAfter: RetryAfterReader = (response) => Number(response.headers.get("retry-after"));

  async function slack(token: string, method: string, parameters: Record<string, string | boolean> = {}, { isGet = false } = {}) {
    const url = `${slackBase}/${method}`;
    const headers = { authorization: `Bearer ${token}` };
    const query = new URLSearchParams(Object.entries(parameters).map(([key, value]) => [key, String(value)]));
    const { status, json } = isGet
      ? await call("Slack", `${url}?${query.toString()}`, { method: "GET", headers }, readSlackRetryAfter)
      : await call(
          "Slack",
          url,
          { method: "POST", headers: { ...headers, "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(parameters) },
          readSlackRetryAfter,
        );
    if (!isRecord(json)) throw new ChatError(`Slack answered ${status} without a reply we can read.`, "bad_reply", status);
    if (json.ok !== true) {
      const code = readString(json, "error") || "error";
      throw new ChatError(SLACK_WORDS[code] ?? `Slack said "${code}".`, code, status);
    }
    return json;
  }

  const readDiscordRetryAfter: RetryAfterReader = (response, json) => {
    const fromBody = isRecord(json) && typeof json.retry_after === "number" ? json.retry_after : null;
    return fromBody ?? Number(response.headers.get("retry-after"));
  };

  async function discord(token: string, method: "GET" | "POST", path: string, body?: unknown) {
    const { status, json } = await call(
      "Discord",
      `${discordBase}${path}`,
      {
        method,
        headers: { authorization: `Bot ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      },
      readDiscordRetryAfter,
    );
    if (status === UNAUTHORIZED_STATUS) throw new ChatError("Discord refused the bot token. Copy it again from the Bot page of your Discord application.", "unauthorized", status);
    if (status === FORBIDDEN_STATUS) {
      throw new ChatError("The bot can't post in that channel. Invite it to your server with the link on this page, and let it send messages there.", "forbidden", status);
    }
    if (status === NOT_FOUND_STATUS) {
      throw new ChatError("Discord can't find that channel. Copy the channel id again (right-click the channel, then Copy Channel ID).", "not_found", status);
    }
    if (status >= CLIENT_ERROR_STATUS) {
      const message = readString(json, "message");
      throw new ChatError(`Discord said ${status}${message ? `: ${message}` : ""}.`, "error", status);
    }
    return json;
  }

  return {
    slack: {
      async whoami(token: string) {
        const answer = await slack(token, "auth.test");
        return { teamId: readString(answer, "team_id"), teamName: readString(answer, "team") };
      },
      // Public channels the bot can see, up to 1,000.
      async listChannels(token: string): Promise<SlackChannel[]> {
        const channels: SlackChannel[] = [];
        let cursor = "";
        for (let page = 0; page < SLACK_CHANNEL_PAGES; page += 1) {
          const answer = await slack(token, "conversations.list", { types: "public_channel", exclude_archived: true, limit: "200", ...(cursor ? { cursor } : {}) }, { isGet: true });
          const listed = Array.isArray(answer.channels) ? answer.channels : [];
          for (const channel of listed) {
            const id = readString(channel, "id");
            if (id) channels.push({ id, name: readString(channel, "name") || id, isMember: isRecord(channel) && channel.is_member === true });
          }
          cursor = readString(answer.response_metadata, "next_cursor");
          if (!cursor) break;
        }
        return channels.toSorted((first, second) => first.name.localeCompare(second.name));
      },
      // The email Slack holds for a user (needs users:read.email), lowercased, or "" when Slack has none.
      async readUserEmail(token: string, userId: string) {
        const answer = await slack(token, "users.info", { user: userId }, { isGet: true });
        const profile = isRecord(answer.user) ? answer.user.profile : null;
        return readString(profile, "email").toLowerCase();
      },
      async post(token: string, channelId: string, text: string) {
        await slack(token, "chat.postMessage", { channel: channelId, text, unfurl_links: false, unfurl_media: false });
      },
    },
    discord: {
      async whoami(token: string) {
        const answer = await discord(token, "GET", "/users/@me");
        return { botId: readString(answer, "id"), botName: readString(answer, "username") };
      },
      async readChannel(token: string, channelId: string) {
        const answer = await discord(token, "GET", `/channels/${encodeURIComponent(channelId)}`);
        return { id: readString(answer, "id") || channelId, name: readString(answer, "name") || channelId };
      },
      async post(token: string, channelId: string, content: string) {
        // No mentions, and flag 4 turns off link previews.
        await discord(token, "POST", `/channels/${encodeURIComponent(channelId)}/messages`, { content, allowed_mentions: { parse: [] }, flags: 4 });
      },
    },
  };
}

export type ChatClient = ReturnType<typeof createChatClient>;
