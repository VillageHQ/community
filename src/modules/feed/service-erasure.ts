import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Transaction } from "../../platform/database/client.ts";
import { DELETED_MEMBER_NAME } from "../members/contract-privacy.ts";
import { MODERATION_TARGETS } from "./contract.ts";
import { comment, moderationRecord, post, reaction } from "./schema.ts";

// Kept in moderation copies in place of the words of a deleted account.
export const ERASED_TEXT = "Deleted with the member's account.";

// A deleted account: their posts, replies and reactions go with no copy of their words. Other members' replies under
// their posts go too, and keep the usual moderation copy, because those words belong to the people who wrote them.
// Moderation copies made earlier of the member's own words, or naming them as the admin who deleted, lose the text.
export async function eraseMemberFeed(transaction: Transaction, memberId: string, actorId: string, actorName: string) {
  const posts = await transaction.select({ id: post.id }).from(post).where(eq(post.authorId, memberId));
  const postIds = posts.map(({ id }) => id);
  if (postIds.length > 0) {
    const othersReplies = await transaction
      .select({ targetId: comment.id, parentPostId: comment.postId, targetAuthorId: comment.authorId, targetAuthorName: user.name, targetBody: comment.body })
      .from(comment)
      .innerJoin(user, eq(user.id, comment.authorId))
      .where(and(inArray(comment.postId, postIds), ne(comment.authorId, memberId)));
    if (othersReplies.length > 0) {
      await transaction
        .insert(moderationRecord)
        .values(othersReplies.map((reply) => ({ ...reply, targetType: MODERATION_TARGETS.comment, deletedByUserId: actorId, deletedByName: actorName })));
    }
  }
  await transaction.delete(post).where(eq(post.authorId, memberId));
  await transaction.delete(comment).where(eq(comment.authorId, memberId));
  await transaction.delete(reaction).where(eq(reaction.userId, memberId));
  await transaction
    .update(moderationRecord)
    .set({ targetAuthorName: DELETED_MEMBER_NAME, targetBody: ERASED_TEXT })
    .where(eq(moderationRecord.targetAuthorId, memberId));
  await transaction.update(moderationRecord).set({ deletedByName: DELETED_MEMBER_NAME }).where(eq(moderationRecord.deletedByUserId, memberId));
}
