import "server-only";

import { and, asc, count, desc, eq, exists, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import { memberRemoval, memberAvatar, memberProfile } from "../members/schema.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { comment, post, reaction } from "./schema.ts";
import { isActiveMember, isBanActive } from "../../platform/auth/member-status.ts";
import { toAvatarUrl } from "../members/service-profile.ts";
import { isAdminMember } from "../../platform/auth/roles.ts";
import { NetworkRequestError } from "../../platform/http/request-error.ts";
import { type SessionMember } from "../../platform/http/request-context.ts";
import {
  commentSchema,
  FEED_ERROR_CODES,
  FEED_LIMITS,
  postSchema,
  reactionCountSchema,
  type Comment,
  type CommentPage,
  type FeedCursor,
  type FeedPage,
  type Post,
  type ReactionCount,
} from "./contract.ts";

const NOT_FOUND_STATUS = 404;
const pinner = alias(user, "pinner");

type AuthorRow = {
  authorId: string;
  authorName: string;
  authorTitle: string | null;
  authorCompany: string | null;
  authorAvatarUpdatedAt: Date | null;
  authorBanned: boolean | null;
  authorBanExpires: Date | null;
};

const AUTHOR_COLUMNS = {
  authorId: user.id,
  authorName: user.name,
  authorTitle: memberProfile.title,
  authorCompany: memberProfile.company,
  authorAvatarUpdatedAt: memberAvatar.updatedAt,
  authorBanned: user.banned,
  authorBanExpires: user.banExpires,
};

function toAuthor(row: AuthorRow) {
  const { authorId, authorName, authorTitle, authorCompany, authorAvatarUpdatedAt, authorBanned, authorBanExpires } = row;
  return {
    id: authorId,
    name: authorName,
    title: authorTitle,
    company: authorCompany,
    avatarUrl: toAvatarUrl(authorId, authorAvatarUpdatedAt),
    isBanned: isBanActive({ banned: authorBanned, banExpires: authorBanExpires }),
  };
}

function isRemovedWithContentKept() {
  const keptRemoval = new QueryBuilder()
    .select({ userId: memberRemoval.userId })
    .from(memberRemoval)
    .where(and(eq(memberRemoval.userId, user.id), eq(memberRemoval.keepsContent, true)));
  return exists(keptRemoval);
}

export function isAuthorVisibleTo(viewer: SessionMember) {
  return isAdminMember(viewer) ? undefined : or(isActiveMember(), isRemovedWithContentKept());
}

function selectPosts(database: Database) {
  return database
    .select({
      id: post.id,
      type: post.type,
      body: post.body,
      createdAt: post.createdAt,
      editedAt: post.editedAt,
      pinnedAt: post.pinnedAt,
      pinnedByName: pinner.name,
      ...AUTHOR_COLUMNS,
    })
    .from(post)
    .innerJoin(user, eq(user.id, post.authorId))
    .leftJoin(memberProfile, eq(memberProfile.userId, post.authorId))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, post.authorId))
    .leftJoin(pinner, and(eq(pinner.id, post.pinnedByUserId), isActiveMember(new Date(), pinner)));
}

type PostRow = Awaited<ReturnType<typeof selectPosts>>[number];

function selectComments(database: Database) {
  return database
    .select({
      id: comment.id,
      postId: comment.postId,
      body: comment.body,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
      ...AUTHOR_COLUMNS,
    })
    .from(comment)
    .innerJoin(user, eq(user.id, comment.authorId))
    .leftJoin(memberProfile, eq(memberProfile.userId, comment.authorId))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, comment.authorId));
}

type CommentRow = Awaited<ReturnType<typeof selectComments>>[number];

function toComment(row: CommentRow): Comment {
  return commentSchema.parse({
    id: row.id,
    postId: row.postId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    author: toAuthor(row),
  });
}

export async function readReactionCounts(database: Database, postIds: string[], viewerId: string) {
  const reactionsByPost = new Map<string, ReactionCount[]>();
  if (postIds.length === 0) return reactionsByPost;

  const reactionCount = count();
  const rows = await database
    .select({
      postId: reaction.postId,
      reaction: reaction.reaction,
      reactionCount,
      isMine: sql<boolean>`bool_or(${reaction.userId} = ${viewerId})`,
    })
    .from(reaction)
    .innerJoin(user, eq(user.id, reaction.userId))
    .where(and(inArray(reaction.postId, postIds), isActiveMember()))
    .groupBy(reaction.postId, reaction.reaction)
    .orderBy(desc(reactionCount), asc(reaction.reaction));

  for (const { postId, reaction: kind, reactionCount: total, isMine } of rows) {
    const parsed = reactionCountSchema.parse({ reaction: kind, count: total, isMine });
    reactionsByPost.set(postId, [...(reactionsByPost.get(postId) ?? []), parsed]);
  }
  return reactionsByPost;
}

async function readCommentCounts(database: Database, postIds: string[], viewer: SessionMember) {
  if (postIds.length === 0) return new Map<string, number>();
  const rows = await database
    .select({ postId: comment.postId, commentCount: count() })
    .from(comment)
    .innerJoin(user, eq(user.id, comment.authorId))
    .where(and(inArray(comment.postId, postIds), isAuthorVisibleTo(viewer)))
    .groupBy(comment.postId);
  return new Map(rows.map(({ postId, commentCount }) => [postId, commentCount]));
}

async function readInlineComments(database: Database, postIds: string[], viewer: SessionMember) {
  const commentsByPost = new Map<string, Comment[]>();
  if (postIds.length === 0) return commentsByPost;

  const rows = await selectComments(database)
    .where(and(inArray(comment.postId, postIds), isAuthorVisibleTo(viewer)))
    .orderBy(asc(comment.createdAt), asc(comment.id));
  for (const row of rows) commentsByPost.set(row.postId, [...(commentsByPost.get(row.postId) ?? []), toComment(row)]);
  return commentsByPost;
}

async function toPosts(database: Database, rows: PostRow[], viewer: SessionMember): Promise<Post[]> {
  const postIds = rows.map(({ id }) => id);
  const [reactionsByPost, commentCounts] = await Promise.all([
    readReactionCounts(database, postIds, viewer.id),
    readCommentCounts(database, postIds, viewer),
  ]);
  const shortThreadIds = postIds.filter((id) => (commentCounts.get(id) ?? 0) <= FEED_LIMITS.inlineComments);
  const commentsByPost = await readInlineComments(database, shortThreadIds, viewer);

  return rows.map((row) =>
    postSchema.parse({
      id: row.id,
      type: row.type,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      author: toAuthor(row),
      pin: row.pinnedAt ? { pinnedAt: row.pinnedAt.toISOString(), pinnedByName: row.pinnedByName } : null,
      reactions: reactionsByPost.get(row.id) ?? [],
      commentCount: commentCounts.get(row.id) ?? 0,
      inlineComments: commentsByPost.get(row.id) ?? [],
    }),
  );
}

function isBeforeCursor(cursor: FeedCursor | null) {
  if (!cursor) return undefined;
  const createdAt = new Date(cursor.createdAt);
  return or(lt(post.createdAt, createdAt), and(eq(post.createdAt, createdAt), lt(post.id, cursor.id)));
}

function isAfterCursor(cursor: FeedCursor | null) {
  if (!cursor) return undefined;
  const createdAt = new Date(cursor.createdAt);
  return or(gt(comment.createdAt, createdAt), and(eq(comment.createdAt, createdAt), gt(comment.id, cursor.id)));
}

function toCursor(row: { createdAt: Date; id: string } | undefined) {
  return row ? { createdAt: row.createdAt.toISOString(), id: row.id } : null;
}

function readPinnedRows(database: Database, viewer: SessionMember) {
  return selectPosts(database)
    .where(and(isNotNull(post.pinnedAt), isAuthorVisibleTo(viewer)))
    .orderBy(desc(post.pinnedAt), desc(post.id));
}

function readNewestAt(rows: PostRow[]) {
  const newestMs = Math.max(...rows.map(({ createdAt }) => createdAt.getTime()));
  return Number.isFinite(newestMs) ? new Date(newestMs).toISOString() : null;
}

export async function readFeedPage(database: Database, viewer: SessionMember, cursor: FeedCursor | null): Promise<FeedPage> {
  const pageSize = FEED_LIMITS.postsPerPage;
  const [pinnedRows, timelineRows] = await Promise.all([
    cursor ? [] : readPinnedRows(database, viewer),
    selectPosts(database)
      .where(and(isNull(post.pinnedAt), isAuthorVisibleTo(viewer), isBeforeCursor(cursor)))
      .orderBy(desc(post.createdAt), desc(post.id))
      .limit(pageSize + 1),
  ]);
  const pageRows = timelineRows.slice(0, pageSize);
  const hasNextPage = timelineRows.length > pageSize;
  const [pinnedPosts, posts] = await Promise.all([
    toPosts(database, pinnedRows, viewer),
    toPosts(database, pageRows, viewer),
  ]);

  return {
    pinnedPosts,
    posts,
    nextCursor: hasNextPage ? toCursor(pageRows.at(-1)) : null,
    newestPostAt: readNewestAt([...pinnedRows, ...pageRows]),
  };
}

export async function readPost(database: Database, viewer: SessionMember, postId: string) {
  const rows = await selectPosts(database).where(and(eq(post.id, postId), isAuthorVisibleTo(viewer)));
  const [hydrated] = await toPosts(database, rows, viewer);
  return hydrated ?? null;
}

export async function readNewPostCount(database: Database, viewerId: string, since: string | null) {
  const [row] = await database
    .select({ newPostCount: count() })
    .from(post)
    .innerJoin(user, eq(user.id, post.authorId))
    .where(and(ne(post.authorId, viewerId), isActiveMember(), since ? gt(post.createdAt, new Date(since)) : undefined));
  return row?.newPostCount ?? 0;
}

export async function isPostVisible(database: Database, viewer: SessionMember, postId: string) {
  const rows = await database
    .select({ id: post.id })
    .from(post)
    .innerJoin(user, eq(user.id, post.authorId))
    .where(and(eq(post.id, postId), isAuthorVisibleTo(viewer)));
  return rows.length > 0;
}

type CommentPageRequest = { postId: string; cursor: FeedCursor | null };

export async function readCommentPage(
  database: Database,
  viewer: SessionMember,
  { postId, cursor }: CommentPageRequest,
): Promise<CommentPage> {
  if (!(await isPostVisible(database, viewer, postId))) {
    throw new NetworkRequestError(NOT_FOUND_STATUS, FEED_ERROR_CODES.notFound, "This post is gone.");
  }
  const pageSize = FEED_LIMITS.commentsPerPage;
  const rows = await selectComments(database)
    .where(and(eq(comment.postId, postId), isAuthorVisibleTo(viewer), isAfterCursor(cursor)))
    .orderBy(asc(comment.createdAt), asc(comment.id))
    .limit(pageSize + 1);
  const pageRows = rows.slice(0, pageSize);
  return {
    comments: pageRows.map(toComment),
    nextCursor: rows.length > pageSize ? toCursor(pageRows.at(-1)) : null,
  };
}

export async function readComment(database: Database, commentId: string) {
  const [row] = await selectComments(database).where(and(eq(comment.id, commentId), isActiveMember()));
  return row ? toComment(row) : null;
}
