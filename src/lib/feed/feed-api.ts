import { z } from "zod";

import { removeBidiControls, removeNullBytes } from "../safe-text.ts";

export const FEED_LIMITS = {
  postLength: 3000,
  commentLength: 1000,
  postsPerPage: 15,
  commentsPerPage: 20,
  inlineComments: 2,
  pinnedPosts: 3,
} as const;

export const POST_TYPES = { plain: "plain", ask: "ask", win: "win", offer: "offer" } as const;
export const REACTIONS = { heart: "heart", thumbsUp: "thumbs_up", idea: "idea", rocket: "rocket" } as const;
export const MODERATION_TARGETS = { post: "post", comment: "comment" } as const;

export const FEED_ERROR_CODES = {
  notFound: "feed_not_found",
  notYours: "feed_not_yours",
  pinLimit: "feed_pin_limit",
  tooFast: "feed_too_fast",
  authorBanned: "feed_author_banned",
} as const;

const REPEATED_BLANK_LINES = /\n{3,}/g;
const WINDOWS_LINE_BREAK = /\r\n?/g;
const VISIBLE_CHARACTER = /[\p{L}\p{N}\p{P}\p{S}]/u;

function normalizeLineBreaks(text: string) {
  return text.replace(WINDOWS_LINE_BREAK, "\n").replace(REPEATED_BLANK_LINES, "\n\n");
}

function feedTextSchema(label: string, maximumLength: number) {
  return z
    .string({ error: `Write ${label} first.` })
    .overwrite(removeNullBytes)
    .overwrite(removeBidiControls)
    .overwrite(normalizeLineBreaks)
    .trim()
    .refine((text) => VISIBLE_CHARACTER.test(text), `Write ${label} first.`)
    .refine((text) => text.length <= maximumLength, `Keep ${label} under ${maximumLength.toLocaleString("en-US")} characters.`);
}

const postBodySchema = feedTextSchema("your post", FEED_LIMITS.postLength);
const commentBodySchema = feedTextSchema("your reply", FEED_LIMITS.commentLength);
const postTypeSchema = z.enum(POST_TYPES);
const reactionSchema = z.enum(REACTIONS);

const timestampSchema = z.iso.datetime();

export const feedCursorSchema = z.object({ createdAt: timestampSchema, id: z.uuid() });

export const feedPageBodySchema = z.object({ cursor: feedCursorSchema.nullable().default(null) });
export const newPostCountBodySchema = z.object({ since: timestampSchema.nullable() });
export const createPostBodySchema = z.object({ type: postTypeSchema.default(POST_TYPES.plain), body: postBodySchema });
export const editPostBodySchema = z.object({ postId: z.uuid(), type: postTypeSchema, body: postBodySchema });
export const postIdBodySchema = z.object({ postId: z.uuid() });
export const pinPostBodySchema = z.object({ postId: z.uuid(), isPinned: z.boolean() });
export const setReactionBodySchema = z.object({ postId: z.uuid(), reaction: reactionSchema, isActive: z.boolean() });
export const commentPageBodySchema = z.object({ postId: z.uuid(), cursor: feedCursorSchema.nullable().default(null) });
export const createCommentBodySchema = z.object({ postId: z.uuid(), body: commentBodySchema });
export const editCommentBodySchema = z.object({ commentId: z.uuid(), body: commentBodySchema });
export const commentIdBodySchema = z.object({ commentId: z.uuid() });

const authorSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isBanned: z.boolean(),
});

export const commentSchema = z.object({
  id: z.uuid(),
  postId: z.uuid(),
  body: z.string(),
  createdAt: timestampSchema,
  editedAt: timestampSchema.nullable(),
  author: authorSchema,
});

export const reactionCountSchema = z.object({ reaction: reactionSchema, count: z.number(), isMine: z.boolean() });

export const postSchema = z.object({
  id: z.uuid(),
  type: postTypeSchema,
  body: z.string(),
  createdAt: timestampSchema,
  editedAt: timestampSchema.nullable(),
  author: authorSchema,
  pin: z.object({ pinnedAt: timestampSchema, pinnedByName: z.string().nullable() }).nullable(),
  reactions: z.array(reactionCountSchema),
  commentCount: z.number(),
  inlineComments: z.array(commentSchema),
});

export const feedPageSchema = z.object({
  pinnedPosts: z.array(postSchema),
  posts: z.array(postSchema),
  nextCursor: feedCursorSchema.nullable(),
  newestPostAt: timestampSchema.nullable(),
});

export const commentPageSchema = z.object({
  comments: z.array(commentSchema),
  nextCursor: feedCursorSchema.nullable(),
});

export const newPostCountSchema = z.object({ newPostCount: z.number() });
export const reactionsResponseSchema = z.object({ reactions: z.array(reactionCountSchema) });

export type PostType = z.infer<typeof postTypeSchema>;
export type Reaction = z.infer<typeof reactionSchema>;
export type ReactionCount = z.infer<typeof reactionCountSchema>;
export type Post = z.infer<typeof postSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type FeedPage = z.infer<typeof feedPageSchema>;
export type FeedCursor = z.infer<typeof feedCursorSchema>;
export type CommentPage = z.infer<typeof commentPageSchema>;
export type CreatePostBody = z.infer<typeof createPostBodySchema>;
export type EditPostBody = z.infer<typeof editPostBodySchema>;
export type CreateCommentBody = z.infer<typeof createCommentBodySchema>;
export type EditCommentBody = z.infer<typeof editCommentBodySchema>;
export type SetReactionBody = z.infer<typeof setReactionBodySchema>;
export type PinPostBody = z.infer<typeof pinPostBodySchema>;
