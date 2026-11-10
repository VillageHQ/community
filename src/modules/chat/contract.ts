import { z } from "zod";

export const CHAT_ADMIN_PAGE = "/admin/chat";
export const CHAT_PAGE_TITLE = "Slack and Discord";

export const CHAT_API_ROUTES = {
  admin: "/api/admin/chat",
  slackConnect: "/api/admin/chat/slack/connect",
  slackChannel: "/api/admin/chat/slack/channel",
  discordConnect: "/api/admin/chat/discord/connect",
  test: "/api/admin/chat/test",
  pause: "/api/admin/chat/pause",
  disconnect: "/api/admin/chat/disconnect",
  // Slack calls this one. It carries Slack's signature, never a session.
  slackCommand: "/api/chat/slack/command",
} as const;

export const CHAT_KINDS = { slack: "slack", discord: "discord" } as const;
export type ChatKind = (typeof CHAT_KINDS)[keyof typeof CHAT_KINDS];

export const CHAT_LIMITS = {
  askCharacters: 280,
  errorCharacters: 500,
  signatureWindowSeconds: 5 * 60,
  commandBodyBytes: 64 * 1024,
  // A failed post is tried again at the next ticks, then left for the admin to see.
  postAttempts: 5,
  // The weekly line is late at most this long after the weekly email's moment, then skipped.
  weeklyLineWindowMs: 24 * 60 * 60 * 1000,
} as const;

export const CHAT_POST_STATUSES = { sending: "sending", sent: "sent", failed: "failed" } as const;

export const CHAT_ERROR_CODES = {
  notConnected: "chat_not_connected",
  refused: "chat_refused",
  unstorable: "chat_unstorable",
} as const;

const SLACK_TOKEN_PATTERN = /^xoxb-[A-Za-z0-9-]{6,250}$/;
const SLACK_SECRET_PATTERN = /^[A-Za-z0-9]{16,128}$/;
const DISCORD_TOKEN_PATTERN = /^[A-Za-z0-9._-]{20,200}$/;
const DISCORD_CHANNEL_PATTERN = /^\d{5,25}$/;
const SLACK_CHANNEL_PATTERN = /^[A-Z0-9]{2,30}$/;

const chatKindSchema = z.enum(CHAT_KINDS);

export const slackConnectBodySchema = z.object({
  token: z
    .string()
    .trim()
    .regex(SLACK_TOKEN_PATTERN, "That isn't a bot token. It starts with xoxb- (OAuth & Permissions, Bot User OAuth Token)."),
  signingSecret: z
    .string()
    .trim()
    .regex(SLACK_SECRET_PATTERN, "That isn't a signing secret. Copy it from Basic Information, App Credentials, Signing Secret."),
});

export const slackChannelBodySchema = z.object({
  channelId: z.string().trim().regex(SLACK_CHANNEL_PATTERN, "Pick one of the channels in the list."),
});

export const discordConnectBodySchema = z.object({
  // Empty keeps the saved token, so the admin can change only the channel.
  token: z
    .string()
    .trim()
    .refine((token) => token === "" || DISCORD_TOKEN_PATTERN.test(token), "That isn't a bot token. Copy it from your Discord application's Bot page (Reset Token)."),
  channelId: z
    .string()
    .trim()
    .regex(DISCORD_CHANNEL_PATTERN, "A channel id is a long number. Turn on Developer Mode in Discord, then right-click the channel and choose Copy Channel ID."),
});

export const chatKindBodySchema = z.object({ kind: chatKindSchema });
export const chatPauseBodySchema = z.object({ kind: chatKindSchema, isPaused: z.boolean() });

export type SlackConnectBody = z.infer<typeof slackConnectBodySchema>;
export type DiscordConnectBody = z.infer<typeof discordConnectBodySchema>;

// A connection as pages see it: never a token, only whether it can be used.
export type ChatConnectionView = {
  kind: ChatKind;
  accountName: string | null;
  accountId: string | null;
  channelId: string | null;
  channelName: string | null;
  isPaused: boolean;
  lastPostAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  needsAttention: boolean;
  connectedAt: string;
};

export type SlackChannel = { id: string; name: string; isMember: boolean };

// Discord's invite link asks for Send Messages (2048) and Embed Links (16384), nothing else.
export const DISCORD_BOT_PERMISSIONS = 2048 + 16384;

export function toDiscordInviteLink(applicationId: string) {
  return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(applicationId)}&scope=bot&permissions=${DISCORD_BOT_PERMISSIONS}`;
}
