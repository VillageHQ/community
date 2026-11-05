import "server-only";

import { and, eq, isNull, max, or, sql } from "drizzle-orm";

import { user } from "../../database/auth-schema.ts";
import type { Database } from "../../database/client.ts";
import {
  conversation,
  conversationReadCursor,
  directMessage,
  memberBlock,
  messageReport,
} from "../../database/messages-schema.ts";
import { isActiveMember } from "../members/active-member.ts";
import { NetworkRequestError, type NetworkContext } from "../village/member-network.ts";
import { readPeerId, toConversationPair } from "./conversation-pair.ts";
import { MESSAGE_ERROR_CODES, type MarkReadBody, type SendMessageBody, type SetBlockBody } from "./message-api.ts";
import { isConversationParticipant, isMessageVisibleTo, readMessageForViewer } from "./message-reads.ts";
import { enforceMessagingLimit, MESSAGING_KINDS } from "./sending-limit.ts";

const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseOrTransaction = Database | Transaction;

export function conversationGoneError() {
  return new NetworkRequestError(NOT_FOUND_STATUS, MESSAGE_ERROR_CODES.notFound, "This conversation isn't available.");
}

function messageGoneError() {
  return new NetworkRequestError(NOT_FOUND_STATUS, MESSAGE_ERROR_CODES.notFound, "This message isn't available.");
}

function memberGoneError() {
  return new NetworkRequestError(NOT_FOUND_STATUS, MESSAGE_ERROR_CODES.notFound, "This member isn't available.");
}

function ownConversationError() {
  return new NetworkRequestError(UNPROCESSABLE_STATUS, MESSAGE_ERROR_CODES.ownConversation, "You can't message yourself.");
}

async function lockConversation(transaction: Transaction, conversationId: string, memberId: string) {
  const [locked] = await transaction
    .select({
      memberLowId: conversation.memberLowId,
      memberHighId: conversation.memberHighId,
      lastRevision: conversation.lastRevision,
    })
    .from(conversation)
    .where(and(eq(conversation.id, conversationId), isConversationParticipant(memberId)))
    .for("update");
  if (!locked) throw conversationGoneError();
  return locked;
}

async function isMemberActive(database: DatabaseOrTransaction, memberId: string) {
  const [active] = await database
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, memberId), isActiveMember()));
  return active !== undefined;
}

export async function startConversation({ database, member }: NetworkContext, memberId: string) {
  if (memberId === member.id) throw ownConversationError();
  if (!(await isMemberActive(database, memberId))) throw memberGoneError();

  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.start);
  const pair = toConversationPair(member.id, memberId);
  await database.insert(conversation).values(pair).onConflictDoNothing();
  const [started] = await database
    .select({ conversationId: conversation.id })
    .from(conversation)
    .where(and(eq(conversation.memberLowId, pair.memberLowId), eq(conversation.memberHighId, pair.memberHighId)));
  if (!started) throw conversationGoneError();
  return started;
}

async function readOwnMessageIdByKey(
  database: DatabaseOrTransaction,
  { conversationId, clientKey }: Pick<SendMessageBody, "conversationId" | "clientKey">,
  senderId: string,
) {
  const [existing] = await database
    .select({ id: directMessage.id })
    .from(directMessage)
    .where(
      and(
        eq(directMessage.conversationId, conversationId),
        eq(directMessage.senderId, senderId),
        eq(directMessage.clientKey, clientKey),
      ),
    );
  return existing?.id ?? null;
}

async function readBlockDirections(transaction: Transaction, memberId: string, peerId: string) {
  const blocks = await transaction
    .select({ blockerId: memberBlock.blockerId })
    .from(memberBlock)
    .where(
      or(
        and(eq(memberBlock.blockerId, memberId), eq(memberBlock.blockedId, peerId)),
        and(eq(memberBlock.blockerId, peerId), eq(memberBlock.blockedId, memberId)),
      ),
    );
  return {
    isBlockedByMe: blocks.some(({ blockerId }) => blockerId === memberId),
    isBlockedByPeer: blocks.some(({ blockerId }) => blockerId === peerId),
  };
}

function peerBlockedError() {
  return new NetworkRequestError(CONFLICT_STATUS, MESSAGE_ERROR_CODES.peerBlocked, "You blocked this member. Unblock them to send a message.");
}

function peerUnavailableError() {
  return new NetworkRequestError(CONFLICT_STATUS, MESSAGE_ERROR_CODES.peerUnavailable, "This member isn't available right now.");
}

async function insertMessage(transaction: Transaction, memberId: string, { conversationId, clientKey, body }: SendMessageBody) {
  const target = await lockConversation(transaction, conversationId, memberId);
  const racedMessageId = await readOwnMessageIdByKey(transaction, { conversationId, clientKey }, memberId);
  if (racedMessageId) return racedMessageId;

  const peerId = readPeerId(target, memberId);
  const { isBlockedByMe, isBlockedByPeer } = await readBlockDirections(transaction, memberId, peerId);
  if (isBlockedByMe) throw peerBlockedError();
  if (!(await isMemberActive(transaction, peerId))) throw peerUnavailableError();

  const revision = target.lastRevision + 1;
  await transaction.update(conversation).set({ lastRevision: revision }).where(eq(conversation.id, conversationId));
  const [created] = await transaction
    .insert(directMessage)
    .values({
      conversationId,
      senderId: memberId,
      clientKey,
      body,
      sequence: revision,
      revision,
      isWithheld: isBlockedByPeer,
    })
    .returning({ id: directMessage.id });
  if (!created) throw conversationGoneError();
  return created.id;
}

async function readRequiredMessage(database: Database, viewerId: string, messageId: string) {
  const message = await readMessageForViewer(database, viewerId, messageId);
  if (!message) throw messageGoneError();
  return message;
}

export async function sendMessage({ database, member }: NetworkContext, body: SendMessageBody) {
  const alreadySentId = await readOwnMessageIdByKey(database, body, member.id);
  if (alreadySentId) return readRequiredMessage(database, member.id, alreadySentId);

  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.send);
  const messageId = await database.transaction((transaction) => insertMessage(transaction, member.id, body));
  return readRequiredMessage(database, member.id, messageId);
}

async function readParticipantMessage(database: DatabaseOrTransaction, memberId: string, messageId: string) {
  const [target] = await database
    .select({
      conversationId: directMessage.conversationId,
      senderId: directMessage.senderId,
      body: directMessage.body,
      createdAt: directMessage.createdAt,
      deletedAt: directMessage.deletedAt,
    })
    .from(directMessage)
    .innerJoin(conversation, eq(conversation.id, directMessage.conversationId))
    .where(and(eq(directMessage.id, messageId), isConversationParticipant(memberId), isMessageVisibleTo(memberId)));
  if (!target) throw messageGoneError();
  return target;
}

export async function deleteOwnMessage({ database, member }: NetworkContext, messageId: string) {
  const { conversationId, senderId } = await readParticipantMessage(database, member.id, messageId);
  if (senderId !== member.id) {
    throw new NetworkRequestError(FORBIDDEN_STATUS, MESSAGE_ERROR_CODES.notYours, "You can only delete your own messages.");
  }

  await database.transaction(async (transaction) => {
    const { lastRevision } = await lockConversation(transaction, conversationId, member.id);
    const revision = lastRevision + 1;
    const [deleted] = await transaction
      .update(directMessage)
      .set({ body: null, deletedAt: new Date(), revision })
      .where(and(eq(directMessage.id, messageId), isNull(directMessage.deletedAt)))
      .returning({ id: directMessage.id });
    if (deleted) await transaction.update(conversation).set({ lastRevision: revision }).where(eq(conversation.id, conversationId));
  });
  return readRequiredMessage(database, member.id, messageId);
}

export async function markConversationRead(
  { database, member }: NetworkContext,
  { conversationId, sequence }: MarkReadBody,
) {
  const [newest] = await database
    .select({ newestSequence: max(directMessage.sequence) })
    .from(conversation)
    .leftJoin(
      directMessage,
      and(eq(directMessage.conversationId, conversation.id), isMessageVisibleTo(member.id)),
    )
    .where(and(eq(conversation.id, conversationId), isConversationParticipant(member.id)))
    .groupBy(conversation.id);
  if (!newest) throw conversationGoneError();

  const readSequence = Math.min(sequence, newest.newestSequence ?? 0);
  const [cursor] = await database
    .insert(conversationReadCursor)
    .values({ conversationId, memberId: member.id, lastReadSequence: readSequence })
    .onConflictDoUpdate({
      target: [conversationReadCursor.conversationId, conversationReadCursor.memberId],
      set: {
        lastReadSequence: sql`greatest(${conversationReadCursor.lastReadSequence}, excluded.last_read_sequence)`,
      },
    })
    .returning({ lastReadSequence: conversationReadCursor.lastReadSequence });
  return { lastReadSequence: cursor?.lastReadSequence ?? readSequence };
}

export async function reportMessage({ database, member }: NetworkContext, messageId: string) {
  const target = await readParticipantMessage(database, member.id, messageId);
  if (target.senderId === member.id) {
    throw new NetworkRequestError(UNPROCESSABLE_STATUS, MESSAGE_ERROR_CODES.notYours, "You can only report messages you received.");
  }
  if (target.body === null) {
    throw new NetworkRequestError(CONFLICT_STATUS, MESSAGE_ERROR_CODES.deleted, "This message was deleted, so there's nothing to report.");
  }

  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.report);
  await database
    .insert(messageReport)
    .values({
      messageId,
      reporterId: member.id,
      reportedMemberId: target.senderId,
      messageBody: target.body,
      messageSentAt: target.createdAt,
    })
    .onConflictDoNothing();
}

export async function setMemberBlocked({ database, member }: NetworkContext, { memberId, isBlocked }: SetBlockBody) {
  if (memberId === member.id) {
    throw new NetworkRequestError(UNPROCESSABLE_STATUS, MESSAGE_ERROR_CODES.ownConversation, "You can't block yourself.");
  }
  if (!isBlocked) {
    await database.delete(memberBlock).where(and(eq(memberBlock.blockerId, member.id), eq(memberBlock.blockedId, memberId)));
    return { isBlocked };
  }

  const [target] = await database.select({ id: user.id }).from(user).where(eq(user.id, memberId));
  if (!target) throw memberGoneError();
  await database.insert(memberBlock).values({ blockerId: member.id, blockedId: memberId }).onConflictDoNothing();
  return { isBlocked };
}
