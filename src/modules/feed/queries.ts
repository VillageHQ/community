import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import {
  type FeedReportBody,
  commentPageSchema,
  commentSchema,
  feedPageSchema,
  newPostCountSchema,
  postSchema,
  reactionsResponseSchema,
  type CreateCommentBody,
  type CreatePostBody,
  type EditCommentBody,
  type EditPostBody,
  type FeedCursor,
  type PinPostBody,
  type SetReactionBody,
} from "@/modules/feed/contract";
import { readNewPostPollMs } from "@/modules/feed/rules-polling";
import { API_ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

export const FEED_QUERY_KEYS = {
  timeline: "feed-timeline",
  newPostCount: "feed-new-post-count",
  comments: "feed-comments",
} as const;

export const FEED_MUTATION_KEYS = { reaction: "feed-reaction" } as const;

const FIRST_PAGE: FeedCursor | null = null;
const TIMELINE_STALE_MS = 30_000;

export function feedQuery() {
  return infiniteQueryOptions({
    queryKey: [FEED_QUERY_KEYS.timeline],
    queryFn: ({ pageParam }) => postRequest(API_ROUTES.feed, { cursor: pageParam }, feedPageSchema),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: ({ nextCursor }) => nextCursor,
    staleTime: TIMELINE_STALE_MS,
  });
}

export function newPostCountQuery(since: string | null) {
  return queryOptions({
    queryKey: [FEED_QUERY_KEYS.newPostCount, since],
    queryFn: () => postRequest(API_ROUTES.feedNewCount, { since }, newPostCountSchema),
    refetchInterval: ({ state }) => readNewPostPollMs(state.status === "error"),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function commentsQuery(postId: string) {
  return infiniteQueryOptions({
    queryKey: [FEED_QUERY_KEYS.comments, postId],
    queryFn: ({ pageParam }) => postRequest(API_ROUTES.feedCommentList, { postId, cursor: pageParam }, commentPageSchema),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: ({ nextCursor }) => nextCursor,
  });
}

export function createPostRequest(body: CreatePostBody) {
  return postRequest(API_ROUTES.feedPosts, body, postSchema);
}

export function editPostRequest(body: EditPostBody) {
  return postRequest(API_ROUTES.feedPostEdit, body, postSchema);
}

export function deletePostRequest(postId: string) {
  return postRequest(API_ROUTES.feedPostDelete, { postId }, acknowledgedResponseSchema);
}

export function pinPostRequest(body: PinPostBody) {
  return postRequest(API_ROUTES.feedPostPin, body, acknowledgedResponseSchema);
}

export function setReactionRequest(body: SetReactionBody) {
  return postRequest(API_ROUTES.feedPostReaction, body, reactionsResponseSchema);
}

export function createCommentRequest(body: CreateCommentBody) {
  return postRequest(API_ROUTES.feedComments, body, commentSchema);
}

export function editCommentRequest(body: EditCommentBody) {
  return postRequest(API_ROUTES.feedCommentEdit, body, commentSchema);
}

export function reportFeedContentRequest(body: FeedReportBody) {
  return postRequest(API_ROUTES.feedReport, body, acknowledgedResponseSchema);
}

export function deleteCommentRequest(commentId: string) {
  return postRequest(API_ROUTES.feedCommentDelete, { commentId }, acknowledgedResponseSchema);
}
