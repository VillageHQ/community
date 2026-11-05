"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type { Post, SetReactionBody } from "@/lib/feed/feed-api";
import {
  addComment,
  changeReaction,
  keepFirstPage,
  prependPost,
  removeComment,
  removePost,
  replaceComment,
  updatePost,
  type FeedTimeline,
} from "@/lib/feed/feed-cache";

import {
  commentsQuery,
  createCommentRequest,
  createPostRequest,
  deleteCommentRequest,
  deletePostRequest,
  editCommentRequest,
  editPostRequest,
  FEED_MUTATION_KEYS,
  feedQuery,
  pinPostRequest,
  reportFeedContentRequest,
  setReactionRequest,
} from "./feed-queries";

async function patchTimeline(queryClient: QueryClient, patch: (timeline: FeedTimeline) => FeedTimeline) {
  await queryClient.cancelQueries(feedQuery());
  queryClient.setQueryData(feedQuery().queryKey, (timeline) => (timeline ? patch(timeline) : timeline));
}

function patchPost(queryClient: QueryClient, postId: string, update: (post: Post) => Post) {
  return patchTimeline(queryClient, (timeline) => updatePost(timeline, postId, update));
}

function refreshThread(queryClient: QueryClient, postId: string) {
  return queryClient.invalidateQueries({ queryKey: commentsQuery(postId).queryKey });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPostRequest,
    onSuccess: (post) => patchTimeline(queryClient, (timeline) => prependPost(timeline, post)),
  });
}

export function useEditPost(wasPinned: boolean, beforeUnpinning: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: editPostRequest,
    onSuccess: (post) => {
      if (post.pin || !wasPinned) return patchPost(queryClient, post.id, () => post);
      beforeUnpinning();
      return queryClient.invalidateQueries({ queryKey: feedQuery().queryKey });
    },
  });
}

export function useDeletePost(beforeRemoval: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePostRequest,
    onSuccess: (_acknowledged, postId) => {
      beforeRemoval();
      return patchTimeline(queryClient, (timeline) => removePost(timeline, postId));
    },
  });
}

export function usePinPost(beforeMoving: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pinPostRequest,
    onSuccess: () => {
      beforeMoving();
      return queryClient.invalidateQueries({ queryKey: feedQuery().queryKey });
    },
  });
}

export function useSetReaction(postId: string) {
  const queryClient = useQueryClient();
  const mutationKey = [FEED_MUTATION_KEYS.reaction, postId];
  return useMutation({
    mutationKey,
    scope: { id: `${FEED_MUTATION_KEYS.reaction}-${postId}` },
    mutationFn: setReactionRequest,
    onMutate: ({ reaction, isActive }: SetReactionBody) =>
      patchPost(queryClient, postId, (post) => ({
        ...post,
        reactions: changeReaction(post.reactions, reaction, isActive),
      })),
    onError: (_error, { reaction, isActive }) =>
      patchPost(queryClient, postId, (post) => ({
        ...post,
        reactions: changeReaction(post.reactions, reaction, !isActive),
      })),
    onSuccess: ({ reactions }) => {
      if (queryClient.isMutating({ mutationKey }) > 1) return;
      return patchPost(queryClient, postId, (post) => ({ ...post, reactions }));
    },
  });
}

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCommentRequest,
    onSuccess: async (comment) => {
      await patchPost(queryClient, postId, (post) => addComment(post, comment));
      await refreshThread(queryClient, postId);
    },
  });
}

export function useEditComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: editCommentRequest,
    onSuccess: async (comment) => {
      await patchPost(queryClient, postId, (post) => replaceComment(post, comment));
      await refreshThread(queryClient, postId);
    },
  });
}

export function useDeleteComment(postId: string, beforeRemoval: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCommentRequest,
    onSuccess: async (_acknowledged, commentId) => {
      beforeRemoval();
      await patchPost(queryClient, postId, (post) => removeComment(post, commentId));
      await refreshThread(queryClient, postId);
    },
  });
}

export function useReportFeedContent() {
  return useMutation({ mutationFn: reportFeedContentRequest });
}

export function useShowNewPosts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await patchTimeline(queryClient, keepFirstPage);
      await queryClient.refetchQueries({ queryKey: feedQuery().queryKey, exact: true });
    },
  });
}
