import "server-only";

import { and, count, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database, Transaction } from "../../platform/database/client.ts";
import { comment, moderationRecord, post, reaction } from "./schema.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { requireCurrentAdmin, withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { isActiveMember, isBanActive } from "../../platform/auth/member-status.ts";
import { logAdminAction } from "../../platform/observability/route-logging.ts";
import { isAdminMember } from "../../platform/auth/roles.ts";
import { NetworkRequestError } from "../../platform/http/request-error.ts";
import { type NetworkContext, type SessionMember } from "../../platform/http/request-context.ts";
import {
  FEED_ERROR_CODES,
  FEED_LIMITS,
  MODERATION_TARGETS,
  type CreateCommentBody,
  type CreatePostBody,
  type EditCommentBody,
  type EditPostBody,
  type PinPostBody,
  type SetReactionBody,
} from "./contract.ts";
import { isAuthorVisibleTo, readComment, readPost, readReactionCounts } from "./reads.ts";

const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const PIN_LOCK_ID = 7260412;
const RECORD_BATCH_SIZE = 500;

type ModerationRow = typeof moderationRecord.$inferInsert;

function postGoneError() {
  return new NetworkRequestError(NOT_FOUND_STATUS, FEED_ERROR_CODES.notFound, "This post is gone.");
}

function commentGoneError() {
  return new NetworkRequestError(NOT_FOUND_STATUS, FEED_ERROR_CODES.notFound, "This reply is gone.");
}

function notYoursError() {
  return new NetworkRequestError(FORBIDDEN_STATUS, FEED_ERROR_CODES.notYours, "You can only change what you wrote.");
}

function pinLimitError() {
  return new NetworkRequestError(
    CONFLICT_STATUS,
    FEED_ERROR_CODES.pinLimit,
    `You can pin ${FEED_LIMITS.pinnedPosts} posts at a time. Unpin one first.`,
  );
}

function bannedAuthorError() {
  return new NetworkRequestError(
    CONFLICT_STATUS,
    FEED_ERROR_CODES.authorBanned,
    "This member is banned, so members can't see their post. You can delete it instead.",
  );
}

async function lockPost(transaction: Transaction, postId: string, viewer: SessionMember) {
  const [target] = await transaction
    .select({
      id: post.id,
      authorId: post.authorId,
      authorName: user.name,
      authorBanned: user.banned,
      authorBanExpires: user.banExpires,
      body: post.body,
      type: post.type,
      pinnedAt: post.pinnedAt,
    })
    .from(post)
    .innerJoin(user, eq(user.id, post.authorId))
    .where(and(eq(post.id, postId), isAuthorVisibleTo(viewer)))
    .for("update", { of: post });
  if (!target) throw postGoneError();
  return target;
}

async function lockComment(transaction: Transaction, commentId: string, viewer: SessionMember) {
  const [target] = await transaction
    .select({ id: comment.id, postId: comment.postId, authorId: comment.authorId, authorName: user.name, body: comment.body })
    .from(comment)
    .innerJoin(user, eq(user.id, comment.authorId))
    .where(and(eq(comment.id, commentId), isAuthorVisibleTo(viewer)))
    .for("update", { of: comment });
  if (!target) throw commentGoneError();
  return target;
}

async function lockPostForChild(transaction: Transaction, postId: string) {
  const [target] = await transaction
    .select({ id: post.id })
    .from(post)
    .innerJoin(user, eq(user.id, post.authorId))
    .where(and(eq(post.id, postId), isActiveMember()))
    .for("share", { of: post });
  if (!target) throw postGoneError();
}

function assertAuthor(member: SessionMember, authorId: string) {
  if (authorId !== member.id) throw notYoursError();
}

async function assertCanDelete(transaction: Transaction, member: SessionMember, authorId: string) {
  if (authorId === member.id) return;
  if (!isAdminMember(member)) throw notYoursError();
  await requireCurrentAdmin(transaction, member.id);
}

async function readMemberName(transaction: Transaction, memberId: string) {
  const [row] = await transaction.select({ name: user.name }).from(user).where(eq(user.id, memberId));
  return row?.name ?? "";
}

async function writeRecords(transaction: Transaction, records: ModerationRow[]) {
  for (let start = 0; start < records.length; start += RECORD_BATCH_SIZE) {
    await transaction.insert(moderationRecord).values(records.slice(start, start + RECORD_BATCH_SIZE));
  }
}

async function readRepliesAsRecords(transaction: Transaction, postId: string) {
  const replies = await transaction
    .select({ targetId: comment.id, targetAuthorId: comment.authorId, targetAuthorName: user.name, targetBody: comment.body })
    .from(comment)
    .innerJoin(user, eq(user.id, comment.authorId))
    .where(eq(comment.postId, postId));
  return replies.map((reply) => ({ ...reply, targetType: MODERATION_TARGETS.comment, parentPostId: postId }));
}

async function readRequiredPost(database: Database, viewer: SessionMember, postId: string) {
  const hydrated = await readPost(database, viewer, postId);
  if (!hydrated) throw postGoneError();
  return hydrated;
}

async function readRequiredComment(database: Database, commentId: string | undefined) {
  const hydrated = commentId ? await readComment(database, commentId) : null;
  if (!hydrated) throw commentGoneError();
  return hydrated;
}

export async function createPost({ database, member }: NetworkContext, { type, body }: CreatePostBody) {
  const [created] = await database.insert(post).values({ authorId: member.id, type, body }).returning({ id: post.id });
  if (!created) throw postGoneError();
  return readRequiredPost(database, member, created.id);
}

function readUnpinFieldsForEdit(member: SessionMember) {
  return isAdminMember(member) ? {} : { pinnedAt: null, pinnedByUserId: null };
}

export async function editPost({ database, member }: NetworkContext, { postId, type, body }: EditPostBody) {
  await database.transaction(async (transaction) => {
    const target = await lockPost(transaction, postId, member);
    assertAuthor(member, target.authorId);
    if (target.body === body && target.type === type) return;
    await transaction
      .update(post)
      .set({ type, body, editedAt: new Date(), ...readUnpinFieldsForEdit(member) })
      .where(eq(post.id, postId));
  });
  return readRequiredPost(database, member, postId);
}

export async function deletePostWithin(transaction: Transaction, member: SessionMember, postId: string) {
  const isAdmin = isAdminMember(member);
  const target = await lockPost(transaction, postId, member);
  await assertCanDelete(transaction, member, target.authorId);
  const replyRecords = isAdmin ? await readRepliesAsRecords(transaction, postId) : [];
  await transaction.delete(post).where(eq(post.id, postId));
  if (!isAdmin) return;

  const deletedBy = { deletedByUserId: member.id, deletedByName: await readMemberName(transaction, member.id) };
  await writeRecords(
    transaction,
    [
      {
        targetType: MODERATION_TARGETS.post,
        targetId: postId,
        targetAuthorId: target.authorId,
        targetAuthorName: target.authorName,
        targetBody: target.body,
        removedReplyCount: replyRecords.length,
      },
      ...replyRecords,
    ].map((record) => ({ ...record, ...deletedBy })),
  );
}

export async function deletePost({ database, member }: NetworkContext, postId: string) {
  await database.transaction((transaction) => deletePostWithin(transaction, member, postId));
  if (isAdminMember(member)) logAdminAction("post_deleted", member.id, postId);
}

type RemovedAuthor = { id: string; name: string };

export async function deleteMemberContent(transaction: Transaction, author: RemovedAuthor, actorId: string) {
  const posts = await transaction.select({ id: post.id, body: post.body }).from(post).where(eq(post.authorId, author.id));
  const postIds = posts.map(({ id }) => id);
  const replies = postIds.length === 0
    ? []
    : await transaction
        .select({ targetId: comment.id, parentPostId: comment.postId, targetAuthorId: comment.authorId, targetAuthorName: user.name, targetBody: comment.body })
        .from(comment)
        .innerJoin(user, eq(user.id, comment.authorId))
        .where(inArray(comment.postId, postIds));
  const ownReplies = await transaction
    .select({ targetId: comment.id, parentPostId: comment.postId, targetBody: comment.body })
    .from(comment)
    .where(and(eq(comment.authorId, author.id), postIds.length === 0 ? undefined : notInArray(comment.postId, postIds)));

  const authorFields = { targetAuthorId: author.id, targetAuthorName: author.name };
  const deletedBy = { deletedByUserId: actorId, deletedByName: await readMemberName(transaction, actorId) };
  const records: ModerationRow[] = [
    ...posts.map(({ id, body }) => ({
      targetType: MODERATION_TARGETS.post,
      targetId: id,
      targetBody: body,
      removedReplyCount: replies.filter(({ parentPostId }) => parentPostId === id).length,
      ...authorFields,
    })),
    ...replies.map((reply) => ({ ...reply, targetType: MODERATION_TARGETS.comment })),
    ...ownReplies.map((reply) => ({ ...reply, ...authorFields, targetType: MODERATION_TARGETS.comment })),
  ].map((record) => ({ ...record, ...deletedBy }));

  await transaction.delete(post).where(eq(post.authorId, author.id));
  await transaction.delete(comment).where(eq(comment.authorId, author.id));
  await transaction.delete(reaction).where(eq(reaction.userId, author.id));
  await writeRecords(transaction, records);
}

async function readPinnedCount(transaction: Transaction) {
  const [row] = await transaction.select({ pinnedCount: count() }).from(post).where(isNotNull(post.pinnedAt));
  return row?.pinnedCount ?? 0;
}

export async function setPostPinned({ database, member }: NetworkContext, { postId, isPinned }: PinPostBody) {
  await withAdminTransaction(database, member.id, async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(${PIN_LOCK_ID})`);
    const target = await lockPost(transaction, postId, member);
    if (isPinned === Boolean(target.pinnedAt)) return;
    if (isPinned && isBanActive({ banned: target.authorBanned, banExpires: target.authorBanExpires })) {
      throw bannedAuthorError();
    }
    if (isPinned && (await readPinnedCount(transaction)) >= FEED_LIMITS.pinnedPosts) throw pinLimitError();
    await transaction
      .update(post)
      .set({ pinnedAt: isPinned ? new Date() : null, pinnedByUserId: isPinned ? member.id : null })
      .where(eq(post.id, postId));
    await recordAdminAction(transaction, member.id, {
      action: isPinned ? AUDIT_ACTIONS.postPinned : AUDIT_ACTIONS.postUnpinned,
      targetMemberId: target.authorId,
      targetName: target.authorName,
    });
  });
  logAdminAction(isPinned ? "post_pinned" : "post_unpinned", member.id, postId);
}

export async function setReaction({ database, member }: NetworkContext, body: SetReactionBody) {
  const { postId, reaction: kind, isActive } = body;
  await database.transaction(async (transaction) => {
    await lockPostForChild(transaction, postId);
    if (isActive) {
      await transaction.insert(reaction).values({ postId, userId: member.id, reaction: kind }).onConflictDoNothing();
      return;
    }
    await transaction
      .delete(reaction)
      .where(and(eq(reaction.postId, postId), eq(reaction.userId, member.id), eq(reaction.reaction, kind)));
  });
  const reactionsByPost = await readReactionCounts(database, [postId], member.id);
  return reactionsByPost.get(postId) ?? [];
}

export async function createComment({ database, member }: NetworkContext, { postId, body }: CreateCommentBody) {
  const commentId = await database.transaction(async (transaction) => {
    await lockPostForChild(transaction, postId);
    const [created] = await transaction
      .insert(comment)
      .values({ postId, authorId: member.id, body })
      .returning({ id: comment.id });
    return created?.id;
  });
  return readRequiredComment(database, commentId);
}

export async function editComment({ database, member }: NetworkContext, { commentId, body }: EditCommentBody) {
  await database.transaction(async (transaction) => {
    const target = await lockComment(transaction, commentId, member);
    assertAuthor(member, target.authorId);
    if (target.body === body) return;
    await transaction.update(comment).set({ body, editedAt: new Date() }).where(eq(comment.id, commentId));
  });
  return readRequiredComment(database, commentId);
}

export async function deleteCommentWithin(transaction: Transaction, member: SessionMember, commentId: string) {
  const target = await lockComment(transaction, commentId, member);
  await assertCanDelete(transaction, member, target.authorId);
  await transaction.delete(comment).where(eq(comment.id, commentId));
  if (!isAdminMember(member)) return;

  await writeRecords(transaction, [
    {
      targetType: MODERATION_TARGETS.comment,
      targetId: commentId,
      parentPostId: target.postId,
      targetAuthorId: target.authorId,
      targetAuthorName: target.authorName,
      targetBody: target.body,
      deletedByUserId: member.id,
      deletedByName: await readMemberName(transaction, member.id),
    },
  ]);
}

export async function deleteComment({ database, member }: NetworkContext, commentId: string) {
  await database.transaction((transaction) => deleteCommentWithin(transaction, member, commentId));
  if (isAdminMember(member)) logAdminAction("comment_deleted", member.id, commentId);
}
