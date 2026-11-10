import "server-only";

import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberAvatar, memberProfile, memberBlock } from "../members/schema.ts";
import { conversation, conversationReadCursor, directMessage, messageReport } from "./schema.ts";
import { isBanActive } from "../../platform/auth/member-status.ts";
import { toContainsPattern } from "../members/reads-directory.ts";
import { filledFaceColumn, shownCompanyColumn, toShownFaceUrl } from "../members/reads-pictures.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import { readPeerId } from "./rules-conversation-pair.ts";
import {
  conversationSummarySchema,
  directMessageSchema,
  MESSAGE_LIMITS,
  threadChangesSchema,
  threadPageSchema,
  type ConversationPeer,
  type Inbox,
  type InboxRequest,
  type ThreadChanges,
  type ThreadPage,
} from "./contract.ts";
import { isBlockedBy } from "../members/service-blocks.ts";

const NOTHING_READ = 0;

export function isConversationParticipant(memberId: string) {
  return or(eq(conversation.memberLowId, memberId), eq(conversation.memberHighId, memberId));
}

export function isMessageVisibleTo(memberId: string) {
  return or(eq(directMessage.senderId, memberId), eq(directMessage.isWithheld, false));
}

export function isUnreadBy(memberId: string) {
  return and(
    isConversationParticipant(memberId),
    ne(directMessage.senderId, memberId),
    eq(directMessage.isWithheld, false),
    isNull(directMessage.deletedAt),
    sql`${conversation.lastRevision} > coalesce(${conversationReadCursor.lastReadSequence}, ${NOTHING_READ})`,
    sql`${directMessage.sequence} > coalesce(${conversationReadCursor.lastReadSequence}, ${NOTHING_READ})`,
  );
}

function selectVisibleMessages(database: Database, viewerId: string) {
  return database
    .select({
      id: directMessage.id,
      senderId: directMessage.senderId,
      body: directMessage.body,
      deletedAt: directMessage.deletedAt,
      reportId: messageReport.id,
      sequence: directMessage.sequence,
      revision: directMessage.revision,
      clientKey: directMessage.clientKey,
      createdAt: directMessage.createdAt,
    })
    .from(directMessage)
    .leftJoin(messageReport, and(eq(messageReport.messageId, directMessage.id), eq(messageReport.reporterId, viewerId)));
}

type MessageRow = Awaited<ReturnType<typeof selectVisibleMessages>>[number];

function toDirectMessage(row: MessageRow, viewerId: string) {
  const isMine = row.senderId === viewerId;
  return directMessageSchema.parse({
    id: row.id,
    isMine,
    body: row.body,
    isDeleted: row.deletedAt !== null,
    isReported: row.reportId !== null,
    sequence: row.sequence,
    clientKey: isMine ? row.clientKey : null,
    createdAt: row.createdAt.toISOString(),
  });
}

function readPeers(database: Database, peerIds: string[]) {
  return database
    .select({
      id: user.id,
      name: user.name,
      title: memberProfile.title,
      company: shownCompanyColumn(user.id),
      avatarUpdatedAt: memberAvatar.updatedAt,
      filledFace: filledFaceColumn(user.id),
      banned: user.banned,
      banExpires: user.banExpires,
    })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
    .where(inArray(user.id, peerIds));
}

type PeerRow = Awaited<ReturnType<typeof readPeers>>[number];

function toPeer({ id, name, title, company, avatarUpdatedAt, filledFace, banned, banExpires }: PeerRow): ConversationPeer {
  return {
    id,
    name,
    title,
    company,
    avatarUrl: toShownFaceUrl(id, avatarUpdatedAt, filledFace),
    isAvailable: !isBanActive({ banned, banExpires }),
  };
}

export async function readParticipantConversation(database: Database, viewerId: string, conversationId: string) {
  const [row] = await database
    .select({
      id: conversation.id,
      memberLowId: conversation.memberLowId,
      memberHighId: conversation.memberHighId,
      lastRevision: conversation.lastRevision,
    })
    .from(conversation)
    .where(and(eq(conversation.id, conversationId), isConversationParticipant(viewerId)));
  return row ?? null;
}

async function readOwnReadSequence(database: Database, conversationId: string, viewerId: string) {
  const [cursor] = await database
    .select({ sequence: conversationReadCursor.lastReadSequence })
    .from(conversationReadCursor)
    .where(and(eq(conversationReadCursor.conversationId, conversationId), eq(conversationReadCursor.memberId, viewerId)));
  return cursor?.sequence ?? NOTHING_READ;
}

type ThreadPageRequest = { viewerId: string; conversationId: string; beforeSequence: number | null };

export async function readThreadPage(
  database: Database,
  { viewerId, conversationId, beforeSequence }: ThreadPageRequest,
): Promise<ThreadPage | null> {
  const found = await readParticipantConversation(database, viewerId, conversationId);
  if (!found) return null;

  const peerId = readPeerId(found, viewerId);
  const pageSize = MESSAGE_LIMITS.messagesPerPage;
  const [rows, [peerRow], lastReadSequence, isBlockedByMe] = await Promise.all([
    selectVisibleMessages(database, viewerId)
      .where(
        and(
          eq(directMessage.conversationId, conversationId),
          isMessageVisibleTo(viewerId),
          beforeSequence === null ? undefined : lt(directMessage.sequence, beforeSequence),
        ),
      )
      .orderBy(desc(directMessage.sequence))
      .limit(pageSize + 1),
    readPeers(database, [peerId]),
    readOwnReadSequence(database, conversationId, viewerId),
    isBlockedBy(database, viewerId, peerId),
  ]);
  if (!peerRow) return null;

  const pageRows = rows.slice(0, pageSize);
  return threadPageSchema.parse({
    conversationId,
    peer: toPeer(peerRow),
    isBlockedByMe,
    messages: pageRows.reverse().map((row) => toDirectMessage(row, viewerId)),
    olderCursor: rows.length > pageSize ? (pageRows[0]?.sequence ?? null) : null,
    revision: found.lastRevision,
    lastReadSequence,
  });
}

type ThreadChangesRequest = { viewerId: string; conversationId: string; afterRevision: number };

async function readChangedMessages(database: Database, { viewerId, conversationId, afterRevision }: ThreadChangesRequest) {
  return selectVisibleMessages(database, viewerId)
    .where(
      and(
        eq(directMessage.conversationId, conversationId),
        isMessageVisibleTo(viewerId),
        gt(directMessage.revision, afterRevision),
      ),
    )
    .orderBy(asc(directMessage.revision))
    .limit(MESSAGE_LIMITS.changesPerPoll + 1);
}

export async function readThreadChanges(database: Database, request: ThreadChangesRequest): Promise<ThreadChanges | null> {
  const { viewerId, conversationId, afterRevision } = request;
  const found = await readParticipantConversation(database, viewerId, conversationId);
  if (!found) return null;

  const peerId = readPeerId(found, viewerId);
  const hasNewRevision = found.lastRevision > afterRevision;
  const [changedRows, [peerRow], isBlockedByMe] = await Promise.all([
    hasNewRevision ? readChangedMessages(database, request) : [],
    database.select({ banned: user.banned, banExpires: user.banExpires }).from(user).where(eq(user.id, peerId)),
    isBlockedBy(database, viewerId, peerId),
  ]);
  const pageRows = changedRows.slice(0, MESSAGE_LIMITS.changesPerPoll);
  const hasMore = changedRows.length > MESSAGE_LIMITS.changesPerPoll;
  const lastChangedRevision = pageRows.at(-1)?.revision ?? afterRevision;

  return threadChangesSchema.parse({
    messages: pageRows.map((row) => toDirectMessage(row, viewerId)),
    revision: hasMore ? lastChangedRevision : Math.max(found.lastRevision, lastChangedRevision),
    hasMore,
    isBlockedByMe,
    isPeerAvailable: peerRow ? !isBanActive(peerRow) : false,
  });
}

export async function readMessageForViewer(database: Database, viewerId: string, messageId: string) {
  const [row] = await selectVisibleMessages(database, viewerId).where(eq(directMessage.id, messageId));
  return row ? toDirectMessage(row, viewerId) : null;
}

function selectUnread(database: Database, viewerId: string, conversationIds?: string[]) {
  return database
    .select({ conversationId: directMessage.conversationId, unreadCount: count() })
    .from(directMessage)
    .innerJoin(conversation, eq(conversation.id, directMessage.conversationId))
    .leftJoin(
      conversationReadCursor,
      and(eq(conversationReadCursor.conversationId, conversation.id), eq(conversationReadCursor.memberId, viewerId)),
    )
    .where(and(isUnreadBy(viewerId), conversationIds ? inArray(directMessage.conversationId, conversationIds) : undefined))
    .groupBy(directMessage.conversationId);
}

export async function readUnreadCount(database: Database, viewerId: string) {
  const rows = await selectUnread(database, viewerId);
  return rows.reduce((total, { unreadCount }) => total + unreadCount, 0);
}

function toPreview(body: string | null) {
  if (body === null) return null;
  const firstLine = removeBidiControls(body).split("\n", 1)[0] ?? "";
  return Array.from(firstLine).slice(0, MESSAGE_LIMITS.previewLength).join("");
}

function selectLatestVisibleMessage(database: Database, viewerId: string) {
  return database
    .select({
      senderId: directMessage.senderId,
      body: directMessage.body,
      deletedAt: directMessage.deletedAt,
      createdAt: directMessage.createdAt,
    })
    .from(directMessage)
    .where(and(eq(directMessage.conversationId, conversation.id), isMessageVisibleTo(viewerId)))
    .orderBy(desc(directMessage.sequence))
    .limit(1)
    .as("latest_message");
}

function isPeerOf(viewerId: string) {
  return or(
    and(eq(conversation.memberLowId, viewerId), eq(user.id, conversation.memberHighId)),
    and(eq(conversation.memberHighId, viewerId), eq(user.id, conversation.memberLowId)),
  );
}

export async function readInbox(database: Database, viewerId: string, { search, cursor }: InboxRequest): Promise<Inbox> {
  const latestMessage = selectLatestVisibleMessage(database, viewerId);
  const cursorTime = cursor ? new Date(cursor.lastMessageAt) : null;
  const rows = await database
    .select({
      conversationId: conversation.id,
      peerId: user.id,
      peerName: user.name,
      peerTitle: memberProfile.title,
      peerCompany: shownCompanyColumn(user.id),
      peerAvatarUpdatedAt: memberAvatar.updatedAt,
      peerFilledFace: filledFaceColumn(user.id),
      peerBanned: user.banned,
      peerBanExpires: user.banExpires,
      blockedId: memberBlock.blockedId,
      senderId: latestMessage.senderId,
      body: latestMessage.body,
      deletedAt: latestMessage.deletedAt,
      createdAt: latestMessage.createdAt,
    })
    .from(conversation)
    .innerJoin(user, isPeerOf(viewerId))
    .innerJoinLateral(latestMessage, sql`true`)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
    .leftJoin(memberBlock, and(eq(memberBlock.blockerId, viewerId), eq(memberBlock.blockedId, user.id)))
    .where(
      and(
        search ? ilike(user.name, toContainsPattern(search)) : undefined,
        cursor && cursorTime
          ? or(
              lt(latestMessage.createdAt, cursorTime),
              and(eq(latestMessage.createdAt, cursorTime), lt(conversation.id, cursor.conversationId)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(latestMessage.createdAt), desc(conversation.id))
    .limit(MESSAGE_LIMITS.conversationsPerPage + 1);

  const pageRows = rows.slice(0, MESSAGE_LIMITS.conversationsPerPage);
  const lastRow = pageRows.at(-1);
  const conversationIds = pageRows.map(({ conversationId }) => conversationId);
  const unreadRows = conversationIds.length > 0 ? await selectUnread(database, viewerId, conversationIds) : [];
  const unreadByConversation = new Map(unreadRows.map(({ conversationId, unreadCount }) => [conversationId, unreadCount]));

  return {
    conversations: pageRows.map((row) =>
      conversationSummarySchema.parse({
        id: row.conversationId,
        peer: toPeer({
          id: row.peerId,
          name: row.peerName,
          title: row.peerTitle,
          company: row.peerCompany,
          avatarUpdatedAt: row.peerAvatarUpdatedAt,
          filledFace: row.peerFilledFace,
          banned: row.peerBanned,
          banExpires: row.peerBanExpires,
        }),
        isBlockedByMe: row.blockedId !== null,
        unreadCount: unreadByConversation.get(row.conversationId) ?? 0,
        lastMessage: {
          preview: toPreview(row.body),
          isMine: row.senderId === viewerId,
          isDeleted: row.deletedAt !== null,
          createdAt: row.createdAt.toISOString(),
        },
      }),
    ),
    nextCursor:
      rows.length > MESSAGE_LIMITS.conversationsPerPage && lastRow
        ? { lastMessageAt: lastRow.createdAt.toISOString(), conversationId: lastRow.conversationId }
        : null,
  };
}
