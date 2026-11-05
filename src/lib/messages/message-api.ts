import { z } from "zod";

import { feedTextSchema } from "../feed/feed-api.ts";
import { removeNullBytes } from "../../platform/text/safe-text.ts";

export const MESSAGE_LIMITS = {
  bodyLength: 4000,
  messagesPerPage: 30,
  changesPerPoll: 100,
  conversationsPerPage: 30,
  previewLength: 140,
  searchLength: 80,
  memberIdLength: 256,
} as const;

export const MESSAGE_ERROR_CODES = {
  notFound: "message_not_found",
  notYours: "message_not_yours",
  tooFast: "message_too_fast",
  ownConversation: "message_own_conversation",
  peerBlocked: "message_peer_blocked",
  peerUnavailable: "message_peer_unavailable",
  deleted: "message_deleted",
} as const;

const LARGEST_POSTGRES_INTEGER = 2_147_483_647;

const timestampSchema = z.iso.datetime();
const sequenceSchema = z.number().int().nonnegative().max(LARGEST_POSTGRES_INTEGER);

const memberIdSchema = z
  .string()
  .overwrite(removeNullBytes)
  .min(1)
  .max(MESSAGE_LIMITS.memberIdLength);

export const messageBodySchema = feedTextSchema("your message", MESSAGE_LIMITS.bodyLength);

export const conversationIdSchema = z.uuid();

export const startConversationBodySchema = z.object({ memberId: memberIdSchema });
export const threadPageBodySchema = z.object({
  conversationId: conversationIdSchema,
  beforeSequence: sequenceSchema.nullable().default(null),
});
export const threadChangesBodySchema = z.object({ conversationId: conversationIdSchema, afterRevision: sequenceSchema });
export const sendMessageBodySchema = z.object({
  conversationId: conversationIdSchema,
  clientKey: z.uuid(),
  body: messageBodySchema,
});
export const messageIdBodySchema = z.object({ messageId: z.uuid() });
export const markReadBodySchema = z.object({ conversationId: conversationIdSchema, sequence: sequenceSchema });
export const setBlockBodySchema = z.object({ memberId: memberIdSchema, isBlocked: z.boolean() });
export const emptyBodySchema = z.object({});

const inboxCursorSchema = z.object({ lastMessageAt: timestampSchema, conversationId: conversationIdSchema });

export const inboxBodySchema = z.object({
  search: z.string().overwrite(removeNullBytes).trim().max(MESSAGE_LIMITS.searchLength).default(""),
  cursor: inboxCursorSchema.nullable().default(null),
});

const peerSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isAvailable: z.boolean(),
});

export const directMessageSchema = z.object({
  id: z.uuid(),
  isMine: z.boolean(),
  body: z.string().nullable(),
  isDeleted: z.boolean(),
  isReported: z.boolean(),
  sequence: sequenceSchema,
  clientKey: z.uuid().nullable(),
  createdAt: timestampSchema,
});

export const threadPageSchema = z.object({
  conversationId: conversationIdSchema,
  peer: peerSchema,
  isBlockedByMe: z.boolean(),
  messages: z.array(directMessageSchema),
  olderCursor: sequenceSchema.nullable(),
  revision: sequenceSchema,
  lastReadSequence: sequenceSchema,
});

export const threadChangesSchema = z.object({
  messages: z.array(directMessageSchema),
  revision: sequenceSchema,
  hasMore: z.boolean(),
  isBlockedByMe: z.boolean(),
  isPeerAvailable: z.boolean(),
});

export const conversationSummarySchema = z.object({
  id: conversationIdSchema,
  peer: peerSchema,
  isBlockedByMe: z.boolean(),
  unreadCount: z.number().int().nonnegative(),
  lastMessage: z.object({
    preview: z.string().nullable(),
    isMine: z.boolean(),
    isDeleted: z.boolean(),
    createdAt: timestampSchema,
  }),
});

export const inboxSchema = z.object({
  conversations: z.array(conversationSummarySchema),
  nextCursor: inboxCursorSchema.nullable(),
});
export const unreadCountSchema = z.object({ unreadCount: z.number().int().nonnegative() });
export const startedConversationSchema = z.object({ conversationId: conversationIdSchema });
export const blockStateSchema = z.object({ isBlocked: z.boolean() });
export const markedReadSchema = z.object({ lastReadSequence: sequenceSchema });

export type DirectMessage = z.infer<typeof directMessageSchema>;
export type ThreadPage = z.infer<typeof threadPageSchema>;
export type ThreadChanges = z.infer<typeof threadChangesSchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type Inbox = z.infer<typeof inboxSchema>;
export type InboxCursor = z.infer<typeof inboxCursorSchema>;
export type InboxRequest = z.infer<typeof inboxBodySchema>;
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
export type SetBlockBody = z.infer<typeof setBlockBodySchema>;
export type MarkReadBody = z.infer<typeof markReadBodySchema>;
export type ConversationPeer = z.infer<typeof peerSchema>;
