import "server-only";

import { and, eq, isNull, or, sql } from "drizzle-orm";

import type { Transaction } from "../../platform/database/client.ts";
import { conversation, conversationReadCursor, directMessage, messageEmailNotice, messageReport } from "./schema.ts";

// Taken before the member row, in the order a send takes them, so a delete and a send can't deadlock.
export async function lockMemberConversations(transaction: Transaction, memberId: string) {
  await transaction
    .select({ id: conversation.id })
    .from(conversation)
    .where(or(eq(conversation.memberLowId, memberId), eq(conversation.memberHighId, memberId)))
    .orderBy(conversation.id)
    .for("update");
}

export const ERASED_MESSAGE_TEXT = "Deleted with the member's account.";

// A deleted account: each of their messages loses its words and shows as deleted to the other member, who keeps the
// conversation and their own messages. Each conversation moves to a new revision, so an open tab picks it up the way it
// picks up any deleted message. A reported copy of their words loses the words too.
export async function eraseMemberMessages(transaction: Transaction, memberId: string) {
  const now = new Date();
  const conversations = await transaction
    .update(conversation)
    .set({ lastRevision: sql`${conversation.lastRevision} + 1` })
    .where(or(eq(conversation.memberLowId, memberId), eq(conversation.memberHighId, memberId)))
    .returning({ id: conversation.id, revision: conversation.lastRevision });
  for (const { id, revision } of conversations) {
    await transaction
      .update(directMessage)
      .set({ body: null, deletedAt: now, revision })
      .where(and(eq(directMessage.conversationId, id), eq(directMessage.senderId, memberId), isNull(directMessage.deletedAt)));
  }
  await transaction.update(messageReport).set({ messageBody: ERASED_MESSAGE_TEXT }).where(eq(messageReport.reportedMemberId, memberId));
  await transaction.delete(messageEmailNotice).where(eq(messageEmailNotice.recipientId, memberId));
  await transaction.delete(conversationReadCursor).where(eq(conversationReadCursor.memberId, memberId));
}
