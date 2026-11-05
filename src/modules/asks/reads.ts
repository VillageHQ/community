import "server-only";

import { and, count, desc, eq, gt, inArray, isNotNull, isNull, lt, notExists, or } from "drizzle-orm";
import { alias, QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { memberAvatar, memberBlock, memberProfile } from "../members/schema.ts";
import { toAvatarUrl } from "../members/service-profile.ts";
import {
  ASK_LIMITS,
  ASK_STATES,
  askBoardPageSchema,
  ownAsksSchema,
  type AskBoardPage,
  type AskCategory,
  type AskCursor,
  type OwnAsks,
} from "./contract.ts";
import { canRenewAsk, readAskState, readExpiresAt, readOldestOpenListing } from "./rules-state.ts";
import { ask, askOffer } from "./schema.ts";

const helper = alias(user, "helper");

export function hasNoBlockBetween(viewerId: string, otherMemberId: AnyPgColumn) {
  const block = new QueryBuilder()
    .select({ blockerId: memberBlock.blockerId })
    .from(memberBlock)
    .where(
      or(
        and(eq(memberBlock.blockerId, viewerId), eq(memberBlock.blockedId, otherMemberId)),
        and(eq(memberBlock.blockerId, otherMemberId), eq(memberBlock.blockedId, viewerId)),
      ),
    );
  return notExists(block);
}

export function isOpenAsk(now: Date) {
  return and(isNull(ask.closedAt), gt(ask.listedAt, readOldestOpenListing(now)));
}

type MemberRow = { id: string; name: string; title: string | null; company: string | null; avatarUpdatedAt: Date | null };

function toAskMember({ id, name, title, company, avatarUpdatedAt }: MemberRow) {
  return { id, name, title, company, avatarUrl: toAvatarUrl(id, avatarUpdatedAt) };
}

function selectBoardAsks(database: Database) {
  return database
    .select({
      id: ask.id,
      title: ask.title,
      detail: ask.detail,
      category: ask.category,
      listedAt: ask.listedAt,
      authorId: user.id,
      authorName: user.name,
      authorTitle: memberProfile.title,
      authorCompany: memberProfile.company,
      authorAvatarUpdatedAt: memberAvatar.updatedAt,
    })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .leftJoin(memberProfile, eq(memberProfile.userId, ask.authorId))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, ask.authorId));
}

function isBeforeCursor(cursor: AskCursor | null) {
  if (!cursor) return undefined;
  const listedAt = new Date(cursor.listedAt);
  return or(lt(ask.listedAt, listedAt), and(eq(ask.listedAt, listedAt), lt(ask.id, cursor.id)));
}

async function readOfferCounts(database: Database, askIds: string[], viewerId: string) {
  if (askIds.length === 0) return new Map<string, number>();
  const rows = await database
    .select({ askId: askOffer.askId, offerCount: count() })
    .from(askOffer)
    .innerJoin(user, eq(user.id, askOffer.helperId))
    .where(and(inArray(askOffer.askId, askIds), isActiveMember(), hasNoBlockBetween(viewerId, askOffer.helperId)))
    .groupBy(askOffer.askId);
  return new Map(rows.map(({ askId, offerCount }) => [askId, offerCount]));
}

async function readMyOffers(database: Database, askIds: string[], viewerId: string) {
  if (askIds.length === 0) return new Map<string, { note: string; createdAt: string }>();
  const rows = await database
    .select({ askId: askOffer.askId, note: askOffer.note, createdAt: askOffer.createdAt })
    .from(askOffer)
    .where(and(inArray(askOffer.askId, askIds), eq(askOffer.helperId, viewerId)));
  return new Map(rows.map(({ askId, note, createdAt }) => [askId, { note, createdAt: createdAt.toISOString() }]));
}

type BoardRequest = { viewerId: string; category: AskCategory | null; cursor: AskCursor | null };

export async function readAskBoard(database: Database, { viewerId, category, cursor }: BoardRequest, now = new Date()): Promise<AskBoardPage> {
  const pageSize = ASK_LIMITS.asksPerPage;
  const rows = await selectBoardAsks(database)
    .where(and(isOpenAsk(now), isActiveMember(now), hasNoBlockBetween(viewerId, ask.authorId), category ? eq(ask.category, category) : undefined, isBeforeCursor(cursor)))
    .orderBy(desc(ask.listedAt), desc(ask.id))
    .limit(pageSize + 1);
  const pageRows = rows.slice(0, pageSize);
  const askIds = pageRows.map(({ id }) => id);
  const [offerCounts, myOffers] = await Promise.all([readOfferCounts(database, askIds, viewerId), readMyOffers(database, askIds, viewerId)]);
  const lastRow = pageRows.at(-1);

  return askBoardPageSchema.parse({
    asks: pageRows.map((row) => ({
      id: row.id,
      title: row.title,
      detail: row.detail,
      category: row.category,
      listedAt: row.listedAt.toISOString(),
      author: toAskMember({ id: row.authorId, name: row.authorName, title: row.authorTitle, company: row.authorCompany, avatarUpdatedAt: row.authorAvatarUpdatedAt }),
      offerCount: offerCounts.get(row.id) ?? 0,
      isMine: row.authorId === viewerId,
      myOffer: myOffers.get(row.id) ?? null,
    })),
    nextCursor: rows.length > pageSize && lastRow ? { listedAt: lastRow.listedAt.toISOString(), id: lastRow.id } : null,
  });
}

async function readOffersOnOwnAsks(database: Database, askIds: string[], viewerId: string, now: Date) {
  if (askIds.length === 0) return [];
  return database
    .select({
      id: askOffer.id,
      askId: askOffer.askId,
      note: askOffer.note,
      seenAt: askOffer.seenAt,
      createdAt: askOffer.createdAt,
      helperId: helper.id,
      helperName: helper.name,
      helperTitle: memberProfile.title,
      helperCompany: memberProfile.company,
      helperAvatarUpdatedAt: memberAvatar.updatedAt,
    })
    .from(askOffer)
    .innerJoin(helper, eq(helper.id, askOffer.helperId))
    .leftJoin(memberProfile, eq(memberProfile.userId, askOffer.helperId))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, askOffer.helperId))
    .where(and(inArray(askOffer.askId, askIds), isActiveMember(now, helper), hasNoBlockBetween(viewerId, askOffer.helperId)))
    .orderBy(desc(askOffer.createdAt), desc(askOffer.id));
}

type OfferRow = Awaited<ReturnType<typeof readOffersOnOwnAsks>>[number];

function toOffer(row: OfferRow) {
  return {
    id: row.id,
    helper: toAskMember({ id: row.helperId, name: row.helperName, title: row.helperTitle, company: row.helperCompany, avatarUpdatedAt: row.helperAvatarUpdatedAt }),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    isNew: row.seenAt === null,
  };
}

export async function readOwnAsks(database: Database, viewerId: string, now = new Date()): Promise<OwnAsks> {
  const columns = { id: ask.id, title: ask.title, detail: ask.detail, category: ask.category, listedAt: ask.listedAt, closedAt: ask.closedAt, outcome: ask.outcome };
  const [activeRows, closedRows] = await Promise.all([
    database.select(columns).from(ask).where(and(eq(ask.authorId, viewerId), isNull(ask.closedAt))).orderBy(desc(ask.listedAt), desc(ask.id)),
    database
      .select(columns)
      .from(ask)
      .where(and(eq(ask.authorId, viewerId), isNotNull(ask.closedAt)))
      .orderBy(desc(ask.closedAt), desc(ask.id))
      .limit(ASK_LIMITS.closedAsksShown),
  ]);
  const rows = [...activeRows, ...closedRows];
  const offers = await readOffersOnOwnAsks(database, rows.map(({ id }) => id), viewerId, now);

  const asks = rows.map((row) => ({
    id: row.id,
    title: row.title,
    detail: row.detail,
    category: row.category,
    listedAt: row.listedAt.toISOString(),
    expiresAt: readExpiresAt(row.listedAt).toISOString(),
    state: readAskState(row, now),
    outcome: row.outcome,
    canRenew: canRenewAsk(row, now),
    offers: offers.filter(({ askId }) => askId === row.id).map(toOffer),
  }));
  return ownAsksSchema.parse({ asks, openCount: asks.filter(({ state }) => state === ASK_STATES.open).length });
}

export async function readNewOfferCount(database: Database, memberId: string, now = new Date()) {
  const [row] = await database
    .select({ newOffers: count() })
    .from(askOffer)
    .innerJoin(ask, eq(ask.id, askOffer.askId))
    .innerJoin(helper, eq(helper.id, askOffer.helperId))
    .where(and(eq(ask.authorId, memberId), isOpenAsk(now), isNull(askOffer.seenAt), isActiveMember(now, helper), hasNoBlockBetween(memberId, askOffer.helperId)));
  return row?.newOffers ?? 0;
}

export async function readOpenAskCount(connection: DatabaseOrTransaction, memberId: string, now: Date) {
  const [row] = await connection
    .select({ openCount: count() })
    .from(ask)
    .where(and(eq(ask.authorId, memberId), isOpenAsk(now)));
  return row?.openCount ?? 0;
}

export async function readReportableAsk(database: Database, viewerId: string, askId: string) {
  const [target] = await database
    .select({ authorId: ask.authorId, title: ask.title, detail: ask.detail, createdAt: ask.createdAt })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(and(eq(ask.id, askId), isActiveMember(), hasNoBlockBetween(viewerId, ask.authorId)));
  return target ?? null;
}
