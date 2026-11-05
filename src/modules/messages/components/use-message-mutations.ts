"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type { DirectMessage } from "@/modules/messages/contract";
import {
  deleteMessageRequest,
  INBOX_QUERY_FILTER,
  markReadRequest,
  pendingMessagesQuery,
  reportMessageRequest,
  sendMessageRequest,
  threadQuery,
  unreadCountQuery,
} from "@/modules/messages/queries";
import { setBlockRequest } from "@/modules/members/queries-blocks";
import {
  addPending,
  clearConversationUnread,
  failPending,
  mergeMessages,
  PENDING_STATUSES,
  removePending,
  updateNewestPage,
  type InboxPages,
  type PendingMessage,
} from "@/modules/messages/rules-thread-cache";

type DraftMessage = Pick<PendingMessage, "clientKey" | "body">;

function patchPending(queryClient: QueryClient, conversationId: string, update: (pending: PendingMessage[]) => PendingMessage[]) {
  queryClient.setQueryData(pendingMessagesQuery(conversationId).queryKey, (pending) => update(pending ?? []));
}

function mergeIntoThread(queryClient: QueryClient, conversationId: string, message: DirectMessage) {
  queryClient.setQueryData(threadQuery(conversationId).queryKey, (thread) => (thread ? mergeMessages(thread, [message]) : thread));
}

function refreshInbox(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries(INBOX_QUERY_FILTER),
    queryClient.invalidateQueries({ queryKey: unreadCountQuery().queryKey }),
  ]);
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientKey, body }: DraftMessage) => sendMessageRequest({ conversationId, clientKey, body }),
    onMutate: ({ clientKey, body }) => {
      patchPending(queryClient, conversationId, (pending) =>
        addPending(pending, {
          clientKey,
          body,
          status: PENDING_STATUSES.sending,
          failureMessage: null,
          createdAt: new Date().toISOString(),
        }),
      );
    },
    onSuccess: (message, { clientKey }) => {
      mergeIntoThread(queryClient, conversationId, message);
      patchPending(queryClient, conversationId, (pending) => removePending(pending, clientKey));
      return refreshInbox(queryClient);
    },
    onError: (error, { clientKey }) => {
      patchPending(queryClient, conversationId, (pending) => failPending(pending, clientKey, error.message));
    },
  });
}

export function useDiscardFailedMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return (clientKey: string) => patchPending(queryClient, conversationId, (pending) => removePending(pending, clientKey));
}

export function useDeleteMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMessageRequest,
    onSuccess: (message) => {
      mergeIntoThread(queryClient, conversationId, message);
      return refreshInbox(queryClient);
    },
  });
}

export function useReportMessage(conversationId: string, message: DirectMessage) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reportMessageRequest(message.id),
    onSuccess: () => mergeIntoThread(queryClient, conversationId, { ...message, isReported: true }),
  });
}

export function useMarkRead(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sequence: number) => markReadRequest({ conversationId, sequence }),
    onSuccess: ({ lastReadSequence }) => {
      queryClient.setQueryData(threadQuery(conversationId).queryKey, (thread) =>
        thread ? updateNewestPage(thread, (page) => ({ ...page, lastReadSequence })) : thread,
      );
      queryClient.setQueriesData<InboxPages>(INBOX_QUERY_FILTER, (inbox) =>
        inbox ? clearConversationUnread(inbox, conversationId) : inbox,
      );
      return refreshInbox(queryClient);
    },
  });
}

export function useSetBlock(memberId: string, conversationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isBlocked: boolean) => setBlockRequest({ memberId, isBlocked }),
    onSuccess: ({ isBlocked }) => {
      if (conversationId) {
        queryClient.setQueryData(threadQuery(conversationId).queryKey, (thread) =>
          thread ? updateNewestPage(thread, (page) => ({ ...page, isBlockedByMe: isBlocked })) : thread,
        );
      }
      return queryClient.invalidateQueries(INBOX_QUERY_FILTER);
    },
  });
}
