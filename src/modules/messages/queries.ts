import { infiniteQueryOptions, queryOptions, skipToken } from "@tanstack/react-query";

import { API_ROUTES } from "../../platform/http/routes.ts";
import { acknowledgedResponseSchema } from "../../platform/http/contract.ts";
import { postNetworkRequest } from "../../platform/http/post-request.ts";
import {
  directMessageSchema,
  inboxSchema,
  markedReadSchema,
  startedConversationSchema,
  threadChangesSchema,
  threadPageSchema,
  unreadCountSchema,
  type InboxCursor,
  type MarkReadBody,
  type SendMessageBody,
} from "./contract.ts";
import { INBOX_POLL_MS, readInboxPollMs } from "../../platform/http/polling.ts";
import { readThreadPollMs } from "./rules-polling.ts";
import { applyThreadChanges, type PendingMessage } from "./rules-thread-cache.ts";

export const MESSAGE_QUERY_KEYS = {
  inbox: "messages-inbox",
  unreadCount: "messages-unread-count",
  thread: "messages-thread",
  threadChanges: "messages-thread-changes",
  pending: "messages-pending",
} as const;

const NEWEST_PAGE: number | null = null;
const FIRST_INBOX_PAGE: InboxCursor | null = null;
const WHOLE_INBOX = "";
const NO_PENDING: PendingMessage[] = [];

export const INBOX_QUERY_FILTER = { queryKey: [MESSAGE_QUERY_KEYS.inbox] };

export function inboxQuery(search = WHOLE_INBOX) {
  return infiniteQueryOptions({
    queryKey: [MESSAGE_QUERY_KEYS.inbox, search],
    queryFn: ({ pageParam }) => postNetworkRequest(API_ROUTES.messages, { search, cursor: pageParam }, inboxSchema),
    initialPageParam: FIRST_INBOX_PAGE,
    getNextPageParam: ({ nextCursor }) => nextCursor,
    staleTime: INBOX_POLL_MS,
    refetchInterval: ({ state }) => readInboxPollMs(state.status === "error"),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function unreadCountQuery() {
  return queryOptions({
    queryKey: [MESSAGE_QUERY_KEYS.unreadCount],
    queryFn: () => postNetworkRequest(API_ROUTES.messageUnreadCount, {}, unreadCountSchema),
    staleTime: INBOX_POLL_MS,
    refetchInterval: ({ state }) => readInboxPollMs(state.status === "error"),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function threadQuery(conversationId: string) {
  return infiniteQueryOptions({
    queryKey: [MESSAGE_QUERY_KEYS.thread, conversationId],
    queryFn: ({ pageParam }) =>
      postNetworkRequest(API_ROUTES.messageThread, { conversationId, beforeSequence: pageParam }, threadPageSchema),
    initialPageParam: NEWEST_PAGE,
    getNextPageParam: ({ olderCursor }) => olderCursor,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
}

export function threadChangesQuery(conversationId: string) {
  return queryOptions({
    queryKey: [MESSAGE_QUERY_KEYS.threadChanges, conversationId],
    queryFn: async ({ client }) => {
      const threadKey = threadQuery(conversationId).queryKey;
      const afterRevision = client.getQueryData(threadKey)?.pages[0]?.revision ?? 0;
      const changes = await postNetworkRequest(API_ROUTES.messageChanges, { conversationId, afterRevision }, threadChangesSchema);
      client.setQueryData(threadKey, (thread) => (thread ? applyThreadChanges(thread, changes) : thread));
      if (changes.messages.length > 0) {
        await Promise.all([
          client.invalidateQueries(INBOX_QUERY_FILTER),
          client.invalidateQueries({ queryKey: unreadCountQuery().queryKey }),
        ]);
      }
      return { hasMore: changes.hasMore };
    },
    refetchInterval: ({ state }) =>
      readThreadPollMs({ hasFailed: state.status === "error", hasMore: state.data?.hasMore ?? false }),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    gcTime: 0,
  });
}

export function pendingMessagesQuery(conversationId: string) {
  return queryOptions({
    queryKey: [MESSAGE_QUERY_KEYS.pending, conversationId],
    queryFn: skipToken,
    initialData: NO_PENDING,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
}

export function startConversationRequest(memberId: string) {
  return postNetworkRequest(API_ROUTES.messageStart, { memberId }, startedConversationSchema);
}

export function sendMessageRequest(body: SendMessageBody) {
  return postNetworkRequest(API_ROUTES.messageSend, body, directMessageSchema);
}

export function deleteMessageRequest(messageId: string) {
  return postNetworkRequest(API_ROUTES.messageDelete, { messageId }, directMessageSchema);
}

export function reportMessageRequest(messageId: string) {
  return postNetworkRequest(API_ROUTES.messageReport, { messageId }, acknowledgedResponseSchema);
}

export function markReadRequest(body: MarkReadBody) {
  return postNetworkRequest(API_ROUTES.messageRead, body, markedReadSchema);
}
