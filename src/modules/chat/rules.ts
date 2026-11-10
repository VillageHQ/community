import { createHmac, timingSafeEqual } from "node:crypto";

import { CHAT_API_ROUTES, CHAT_KINDS, CHAT_LIMITS, type ChatKind } from "./contract.ts";

// What the bots post. Plain text, one link each, the community's name first. Member words are escaped so they can't
// mention anyone or add markup.

const SLACK_MARKUP = /[&<>]/g;
const SLACK_ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const DISCORD_MARKDOWN = /([*_~`|\\])/g;
const ZERO_WIDTH_SPACE = "​";
const WHITESPACE = /\s+/g;
const SIGNATURE_VERSION = "v0";
const TIMESTAMP_PATTERN = /^\d{1,12}$/;

function escapeText(kind: ChatKind, text: string) {
  if (kind === CHAT_KINDS.slack) return text.replace(SLACK_MARKUP, (character) => SLACK_ENTITIES[character] ?? character);
  return text.replaceAll("@", `@${ZERO_WIDTH_SPACE}`).replace(DISCORD_MARKDOWN, "\\$1");
}

export function clipText(text: string, maximum: number) {
  const flat = text.replace(WHITESPACE, " ").trim();
  return flat.length > maximum ? `${flat.slice(0, maximum - 1).trimEnd()}…` : flat;
}

function toLink(kind: ChatKind, url: string, label: string) {
  return kind === CHAT_KINDS.slack ? `<${url}|${label}>` : `${label}: <${url}>`;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export type AskPostFacts = { community: string; authorName: string; title: string; url: string };
export type WeekPostFacts = { community: string; introsMade: number; openAsks: number; url: string };

export function composeAskPost(kind: ChatKind, { community, authorName, title, url }: AskPostFacts) {
  const words = escapeText(kind, clipText(title, CHAT_LIMITS.askCharacters));
  return `${escapeText(kind, community)} · new ask from ${escapeText(kind, authorName)}: "${words}"\n${toLink(kind, url, "I can help")}`;
}

export function composeWeekPost(kind: ChatKind, { community, introsMade, openAsks, url }: WeekPostFacts) {
  const numbers = `${plural(introsMade, "intro", "intros")} made, ${plural(openAsks, "ask", "asks")} open.`;
  return `${escapeText(kind, community)} this week: ${numbers} ${toLink(kind, url, "See the asks")}`;
}

export function composeTestPost(kind: ChatKind, { community, url }: { community: string; url: string }) {
  return `${escapeText(kind, community)}: test post. New asks and a weekly line will show up here. ${toLink(kind, url, "Open the community")}`;
}

// The first name only, or "a member" for someone the directory doesn't list.
export function readPostedName(name: string, isListed: boolean) {
  if (!isListed) return "a member";
  return name.trim().split(WHITESPACE)[0] || "a member";
}

// The Slack app's manifest, with this site's address in the slash command.
export function buildSlackManifest(communityName: string, appUrl: string) {
  const name = communityName.trim() || "Our community";
  return {
    display_information: { name: name.slice(0, 35), description: `New asks and a weekly line from ${name}`.slice(0, 140) },
    features: {
      bot_user: { display_name: name.slice(0, 80), always_online: false },
      slash_commands: [
        {
          command: "/ask",
          url: `${appUrl}${CHAT_API_ROUTES.slackCommand}`,
          description: `Post an ask to ${name}`.slice(0, 100),
          usage_hint: "an intro to a hospital buyer in the US",
          should_escape: false,
        },
      ],
    },
    // users:read and users:read.email: /ask finds the member by their Slack email.
    oauth_config: { scopes: { bot: ["chat:write", "commands", "channels:read", "users:read", "users:read.email"] } },
    settings: { org_deploy_enabled: false, socket_mode_enabled: false, token_rotation_enabled: false },
  };
}

export function signSlackBody(secret: string, timestamp: string, body: string) {
  return `${SIGNATURE_VERSION}=${createHmac("sha256", secret).update(`${SIGNATURE_VERSION}:${timestamp}:${body}`).digest("hex")}`;
}

// Slack's request signature: v0=HMAC-SHA256(secret, "v0:<timestamp>:<body>"), sent within the last 5 minutes.
export function isSlackSignatureValid(secret: string, timestamp: string | null, signature: string | null, body: string, nowMs = Date.now()) {
  if (!secret || !timestamp || !signature || !TIMESTAMP_PATTERN.test(timestamp) || !signature.startsWith(`${SIGNATURE_VERSION}=`)) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > CHAT_LIMITS.signatureWindowSeconds) return false;
  const expected = Buffer.from(signSlackBody(secret, timestamp, body));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
