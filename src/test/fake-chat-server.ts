import { createHmac, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

// A fake Slack and a fake Discord in one small HTTP server: the Web API methods and REST routes the app calls, a few
// made-up channels and users, every post it received, a switch that answers 429 a given number of times, and one that
// revokes a token. No real workspace, no network, no real token.

export const FAKE_SLACK_TOKEN = "xoxb-fake-good-token";
export const FAKE_SLACK_SIGNING_SECRET = "fakesigningsecret0123456789abcdef";
export const FAKE_SLACK_TEAM = { id: "T0FAKE", name: "Northwind Founders (fake)" };
export const FAKE_DISCORD_TOKEN = "fake.discord.token-good-0000";
export const FAKE_DISCORD_CHANNEL = "1100000000000000001";
export const FAKE_DISCORD_BOT_ID = "1300000000000000099";

export const FAKE_SLACK_CHANNELS = [
  { id: "C0GENERAL", name: "general", is_member: true },
  { id: "C0ASKS", name: "founder-asks", is_member: true },
  { id: "C0RANDOM", name: "random", is_member: false },
];
const DISCORD_CHANNELS: Record<string, string> = { [FAKE_DISCORD_CHANNEL]: "asks", "1100000000000000002": "general" };

type ChatKind = "slack" | "discord";
export type FakePost = { kind: ChatKind; channel: string; text: string };

// What Slack sends as X-Slack-Request-Timestamp and X-Slack-Signature for a body.
export function signSlackRequest(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
  return { "x-slack-request-timestamp": String(timestamp), "x-slack-signature": signature };
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, { "content-type": "application/json", ...headers });
  response.end(JSON.stringify(body));
}

function parseParameters(request: IncomingMessage, url: URL, raw: string): Record<string, unknown> {
  if (request.method === "GET") return Object.fromEntries(url.searchParams);
  if (String(request.headers["content-type"] ?? "").includes("json")) return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  return Object.fromEntries(new URLSearchParams(raw));
}

export async function startFakeChatServer({ port = 0 }: { port?: number } = {}) {
  const posts: FakePost[] = [];
  const limits: Record<ChatKind, number> = { slack: 0, discord: 0 };
  const goodTokens: Record<ChatKind, string> = { slack: FAKE_SLACK_TOKEN, discord: FAKE_DISCORD_TOKEN };
  const slackUsers = new Map<string, string>([["U0STRANGER", "stranger@example.net"]]);

  async function answerSlack(request: IncomingMessage, response: ServerResponse, method: string, url: URL) {
    const raw = request.method === "POST" ? await readBody(request) : "";
    const parameters = parseParameters(request, url, raw);
    const token = String(request.headers.authorization ?? "").replace(/^Bearer\s+/, "");
    if (token !== goodTokens.slack) return sendJson(response, 200, { ok: false, error: token === FAKE_SLACK_TOKEN ? "token_revoked" : "invalid_auth" });
    if (method === "auth.test") return sendJson(response, 200, { ok: true, team: FAKE_SLACK_TEAM.name, team_id: FAKE_SLACK_TEAM.id, user_id: "U0BOT" });
    if (method === "conversations.list") return sendJson(response, 200, { ok: true, channels: FAKE_SLACK_CHANNELS, response_metadata: { next_cursor: "" } });
    if (method === "users.info") {
      const email = slackUsers.get(String(parameters.user));
      return email ? sendJson(response, 200, { ok: true, user: { id: parameters.user, profile: { email } } }) : sendJson(response, 200, { ok: false, error: "user_not_found" });
    }
    if (method === "chat.postMessage") {
      if (limits.slack > 0) {
        limits.slack -= 1;
        return sendJson(response, 429, { ok: false, error: "ratelimited" }, { "retry-after": "1" });
      }
      const channel = FAKE_SLACK_CHANNELS.find(({ id }) => id === parameters.channel);
      if (!channel) return sendJson(response, 200, { ok: false, error: "channel_not_found" });
      if (!channel.is_member) return sendJson(response, 200, { ok: false, error: "not_in_channel" });
      posts.push({ kind: "slack", channel: `#${channel.name}`, text: String(parameters.text) });
      return sendJson(response, 200, { ok: true, channel: channel.id, ts: String(Date.now() / 1000) });
    }
    return sendJson(response, 200, { ok: false, error: "unknown_method" });
  }

  async function answerDiscord(request: IncomingMessage, response: ServerResponse, route: string) {
    const raw = request.method === "POST" ? await readBody(request) : "";
    const token = String(request.headers.authorization ?? "").replace(/^Bot\s+/, "");
    if (token !== goodTokens.discord) return sendJson(response, 401, { message: "401: Unauthorized", code: 0 });
    if (route === "/users/@me" && request.method === "GET") return sendJson(response, 200, { id: FAKE_DISCORD_BOT_ID, username: "Northwind bot", bot: true });
    const match = route.match(/^\/channels\/(\d+)(\/messages)?$/);
    const name = match?.[1] ? DISCORD_CHANNELS[match[1]] : undefined;
    if (!match || !name) return sendJson(response, 404, { message: "Unknown Channel", code: 10003 });
    if (!match[2] && request.method === "GET") return sendJson(response, 200, { id: match[1], name, type: 0 });
    if (match[2] && request.method === "POST") {
      if (limits.discord > 0) {
        limits.discord -= 1;
        return sendJson(response, 429, { message: "You are being rate limited.", retry_after: 0.2, global: false });
      }
      const body = raw ? (JSON.parse(raw) as { content?: string }) : {};
      posts.push({ kind: "discord", channel: `#${name}`, text: String(body.content) });
      return sendJson(response, 200, { id: String(Date.now()), channel_id: match[1], content: body.content });
    }
    return sendJson(response, 405, { message: "405: Method Not Allowed", code: 0 });
  }

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://fake");
    const slackMethod = url.pathname.match(/^\/slack\/api\/([\w.]+)$/)?.[1];
    const answered = slackMethod
      ? answerSlack(request, response, slackMethod, url)
      : url.pathname.startsWith("/discord/api/v10/")
        ? answerDiscord(request, response, url.pathname.slice("/discord/api/v10".length))
        : Promise.resolve(sendJson(response, 404, { error: "not here" }));
    answered.catch((error: unknown) => sendJson(response, 500, { error: error instanceof Error ? error.message : "failed" }));
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    posts,
    environment: { SLACK_API_BASE: `${base}/slack/api`, DISCORD_API_BASE: `${base}/discord/api/v10` },
    // The next n posts to that tool answer 429.
    limit(kind: ChatKind, count = 1) {
      limits[kind] = count;
    },
    // The saved token stops working, as when an admin revokes it in Slack or resets it in Discord.
    revoke(kind: ChatKind) {
      goodTokens[kind] = `revoked-${randomUUID()}`;
    },
    restore(kind: ChatKind) {
      goodTokens[kind] = kind === "slack" ? FAKE_SLACK_TOKEN : FAKE_DISCORD_TOKEN;
    },
    addSlackUser(userId: string, email: string) {
      slackUsers.set(userId, email);
    },
    reset() {
      posts.length = 0;
      limits.slack = 0;
      limits.discord = 0;
      this.restore("slack");
      this.restore("discord");
    },
    close() {
      return new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    },
  };
}

export type FakeChatServer = Awaited<ReturnType<typeof startFakeChatServer>>;
