import "server-only";

import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, ne, notExists, or } from "drizzle-orm";
import { alias, QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { memberAvatar, memberBlock, memberProfile, memberTag } from "../members/schema.ts";
import { companyLogoColumn, filledFaceColumn, shownCompanyColumn, toShownFaceUrl } from "../members/reads-pictures.ts";
import { readSettings } from "../../platform/settings/store.ts";
import {
  ASK_ALLOWANCE,
  ASK_ALLOWANCE_SETTING,
  ASK_HELPER_REASONS,
  ASK_KINDS,
  ASK_LIMITS,
  ASK_STATES,
  askBoardPageSchema,
  ownAsksSchema,
  type AskBoardPage,
  type AskAnswer,
  type AskCategory,
  type AskCursor,
  type AskHelper,
  type AskKind,
  type OwnAsks,
} from "./contract.ts";
import { findMatchedWords, readWords } from "./rules-help-match.ts";
import { canRenewAsk, readAskState, readExpiresAt, readOldestOpenListing } from "./rules-state.ts";
import { ask, askAnswer, askHelper, askOffer } from "./schema.ts";

const helper = alias(user, "helper");
const answerAuthor = alias(user, "answer_author");
const ALLOWANCE_WINDOW_MS = ASK_LIMITS.allowanceWindowDays * 24 * 60 * 60 * 1000;

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

type MemberRow = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  avatarUpdatedAt: Date | null;
  filledFace: string | null;
  companyLogoUrl: string | null;
};

function toAskMember({ id, name, title, company, avatarUpdatedAt, filledFace, companyLogoUrl }: MemberRow) {
  return { id, name, title, company, avatarUrl: toShownFaceUrl(id, avatarUpdatedAt, filledFace), companyLogoUrl };
}

function selectBoardAsks(database: Database) {
  return database
    .select({
      id: ask.id,
      title: ask.title,
      detail: ask.detail,
      category: ask.category,
      kind: ask.kind,
      targetSlug: ask.targetSlug,
      targetName: ask.targetName,
      listedAt: ask.listedAt,
      authorId: user.id,
      authorName: user.name,
      authorTitle: memberProfile.title,
      authorCompany: shownCompanyColumn(ask.authorId),
      authorAvatarUpdatedAt: memberAvatar.updatedAt,
      authorFilledFace: filledFaceColumn(ask.authorId),
      authorCompanyLogoUrl: companyLogoColumn(ask.authorId),
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

function toTarget(targetSlug: string | null, targetName: string | null) {
  return targetSlug ? { linkedinSlug: targetSlug, name: targetName } : null;
}

// Answers are public under the ask, so every reader gets them, minus the members they can't see.
async function readAnswers(database: Database, askIds: string[], viewerId: string, now: Date) {
  const answers = new Map<string, AskAnswer[]>();
  if (askIds.length === 0) return answers;
  const rows = await database
    .select({
      id: askAnswer.id,
      askId: askAnswer.askId,
      body: askAnswer.body,
      createdAt: askAnswer.createdAt,
      authorId: answerAuthor.id,
      authorName: answerAuthor.name,
      authorTitle: memberProfile.title,
      authorCompany: shownCompanyColumn(askAnswer.authorId),
      authorAvatarUpdatedAt: memberAvatar.updatedAt,
      authorFilledFace: filledFaceColumn(askAnswer.authorId),
      authorCompanyLogoUrl: companyLogoColumn(askAnswer.authorId),
    })
    .from(askAnswer)
    .innerJoin(answerAuthor, eq(answerAuthor.id, askAnswer.authorId))
    .leftJoin(memberProfile, eq(memberProfile.userId, askAnswer.authorId))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, askAnswer.authorId))
    .where(and(inArray(askAnswer.askId, askIds), isActiveMember(now, answerAuthor), hasNoBlockBetween(viewerId, askAnswer.authorId)))
    .orderBy(asc(askAnswer.createdAt), asc(askAnswer.id));
  for (const row of rows) {
    const list = answers.get(row.askId) ?? [];
    list.push({
      id: row.id,
      author: toAskMember({ id: row.authorId, name: row.authorName, title: row.authorTitle, company: row.authorCompany, avatarUpdatedAt: row.authorAvatarUpdatedAt, filledFace: row.authorFilledFace, companyLogoUrl: row.authorCompanyLogoUrl }),
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      isMine: row.authorId === viewerId,
    });
    answers.set(row.askId, list);
  }
  return answers;
}

async function readWhyYou(database: Database, askIds: string[], viewerId: string) {
  if (askIds.length === 0) return new Map<string, string>();
  const rows = await database
    .select({ askId: askHelper.askId, why: askHelper.why })
    .from(askHelper)
    .where(and(inArray(askHelper.askId, askIds), eq(askHelper.helperId, viewerId)));
  return new Map(rows.map(({ askId, why }) => [askId, why]));
}

type BoardRequest = { viewerId: string; category: AskCategory | null; kind: AskKind | null; cursor: AskCursor | null; canIntro: boolean };

export async function readAskBoard(database: Database, { viewerId, category, kind, cursor, canIntro }: BoardRequest, now = new Date()): Promise<AskBoardPage> {
  const pageSize = ASK_LIMITS.asksPerPage;
  const rows = await selectBoardAsks(database)
    .where(and(isOpenAsk(now), isActiveMember(now), hasNoBlockBetween(viewerId, ask.authorId), category ? eq(ask.category, category) : undefined, kind ? eq(ask.kind, kind) : undefined, isBeforeCursor(cursor)))
    .orderBy(desc(ask.listedAt), desc(ask.id))
    .limit(pageSize + 1);
  const pageRows = rows.slice(0, pageSize);
  const askIds = pageRows.map(({ id }) => id);
  const [offerCounts, myOffers, answers, whyYou] = await Promise.all([
    readOfferCounts(database, askIds, viewerId),
    readMyOffers(database, askIds, viewerId),
    readAnswers(database, askIds, viewerId, now),
    readWhyYou(database, askIds, viewerId),
  ]);
  const lastRow = pageRows.at(-1);

  return askBoardPageSchema.parse({
    asks: pageRows.map((row) => ({
      id: row.id,
      title: row.title,
      detail: row.detail,
      category: row.category,
      kind: row.kind,
      listedAt: row.listedAt.toISOString(),
      author: toAskMember({ id: row.authorId, name: row.authorName, title: row.authorTitle, company: row.authorCompany, avatarUpdatedAt: row.authorAvatarUpdatedAt, filledFace: row.authorFilledFace, companyLogoUrl: row.authorCompanyLogoUrl }),
      target: toTarget(row.targetSlug, row.targetName),
      offerCount: offerCounts.get(row.id) ?? 0,
      isMine: row.authorId === viewerId,
      myOffer: myOffers.get(row.id) ?? null,
      answers: answers.get(row.id) ?? [],
      whyYou: whyYou.get(row.id) ?? null,
    })),
    nextCursor: rows.length > pageSize && lastRow ? { listedAt: lastRow.listedAt.toISOString(), id: lastRow.id } : null,
    canIntro,
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
      helperCompany: shownCompanyColumn(askOffer.helperId),
      helperAvatarUpdatedAt: memberAvatar.updatedAt,
      helperFilledFace: filledFaceColumn(askOffer.helperId),
      helperCompanyLogoUrl: companyLogoColumn(askOffer.helperId),
    })
    .from(askOffer)
    .innerJoin(helper, eq(helper.id, askOffer.helperId))
    .leftJoin(memberProfile, eq(memberProfile.userId, askOffer.helperId))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, askOffer.helperId))
    .where(and(inArray(askOffer.askId, askIds), isActiveMember(now, helper), hasNoBlockBetween(viewerId, askOffer.helperId)))
    .orderBy(desc(askOffer.createdAt), desc(askOffer.id));
}

// The helpers an ask was routed to, as the author sees them. A path helper can be asked for the intro.
async function readHelpersOnOwnAsks(database: Database, askIds: string[], viewerId: string, now: Date) {
  const helpers = new Map<string, AskHelper[]>();
  if (askIds.length === 0) return helpers;
  const rows = await database
    .select({
      askId: askHelper.askId,
      reason: askHelper.reason,
      why: askHelper.why,
      connectorSlug: askHelper.connectorSlug,
      helperId: helper.id,
      helperName: helper.name,
      helperTitle: memberProfile.title,
      helperCompany: shownCompanyColumn(askHelper.helperId),
      helperAvatarUpdatedAt: memberAvatar.updatedAt,
      helperFilledFace: filledFaceColumn(askHelper.helperId),
      helperCompanyLogoUrl: companyLogoColumn(askHelper.helperId),
    })
    .from(askHelper)
    .innerJoin(helper, eq(helper.id, askHelper.helperId))
    .leftJoin(memberProfile, eq(memberProfile.userId, askHelper.helperId))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, askHelper.helperId))
    .where(and(inArray(askHelper.askId, askIds), isActiveMember(now, helper), hasNoBlockBetween(viewerId, askHelper.helperId)))
    .orderBy(asc(askHelper.reason), asc(askHelper.createdAt));
  for (const row of rows) {
    const list = helpers.get(row.askId) ?? [];
    const isPath = row.reason === ASK_HELPER_REASONS.path;
    list.push({
      helper: toAskMember({ id: row.helperId, name: row.helperName, title: row.helperTitle, company: row.helperCompany, avatarUpdatedAt: row.helperAvatarUpdatedAt, filledFace: row.helperFilledFace, companyLogoUrl: row.helperCompanyLogoUrl }),
      reason: isPath ? ASK_HELPER_REASONS.path : ASK_HELPER_REASONS.words,
      why: row.why,
      canAskForIntro: isPath && row.connectorSlug !== null,
    });
    helpers.set(row.askId, list);
  }
  return helpers;
}

type OfferRow = Awaited<ReturnType<typeof readOffersOnOwnAsks>>[number];

function toOffer(row: OfferRow) {
  return {
    id: row.id,
    helper: toAskMember({ id: row.helperId, name: row.helperName, title: row.helperTitle, company: row.helperCompany, avatarUpdatedAt: row.helperAvatarUpdatedAt, filledFace: row.helperFilledFace, companyLogoUrl: row.helperCompanyLogoUrl }),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    isNew: row.seenAt === null,
  };
}

type OwnAsksExtras = { canIntro: boolean; allowance: OwnAsks["allowance"] };

export async function readOwnAsks(database: Database, viewerId: string, { canIntro, allowance }: OwnAsksExtras, now = new Date()): Promise<OwnAsks> {
  const columns = {
    id: ask.id,
    title: ask.title,
    detail: ask.detail,
    category: ask.category,
    kind: ask.kind,
    targetSlug: ask.targetSlug,
    targetName: ask.targetName,
    listedAt: ask.listedAt,
    closedAt: ask.closedAt,
    outcome: ask.outcome,
  };
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
  const askIds = rows.map(({ id }) => id);
  const [offers, helpers, answers] = await Promise.all([
    readOffersOnOwnAsks(database, askIds, viewerId, now),
    readHelpersOnOwnAsks(database, askIds, viewerId, now),
    readAnswers(database, askIds, viewerId, now),
  ]);

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
    kind: row.kind,
    target: toTarget(row.targetSlug, row.targetName),
    offers: offers.filter(({ askId }) => askId === row.id).map(toOffer),
    helpers: helpers.get(row.id) ?? [],
    answers: answers.get(row.id) ?? [],
  }));
  return ownAsksSchema.parse({ asks, openCount: asks.filter(({ state }) => state === ASK_STATES.open).length, allowance, canIntro });
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

export async function readWeeklyAllowance(database: DatabaseOrTransaction) {
  const settings = await readSettings(database, [ASK_ALLOWANCE_SETTING]);
  const stored = Number.parseInt(settings.get(ASK_ALLOWANCE_SETTING) ?? "", 10);
  if (!Number.isInteger(stored)) return ASK_ALLOWANCE.default;
  return Math.min(ASK_ALLOWANCE.maximum, Math.max(ASK_ALLOWANCE.minimum, stored));
}

// When each ask (not update) the member posted in the last week was posted. Closing one doesn't give it back, so
// the allowance can't be dodged.
export async function readPostedAskTimes(connection: DatabaseOrTransaction, memberId: string, now: Date) {
  const rows = await connection
    .select({ createdAt: ask.createdAt })
    .from(ask)
    .where(and(eq(ask.authorId, memberId), eq(ask.kind, ASK_KINDS.ask), gte(ask.createdAt, new Date(now.getTime() - ALLOWANCE_WINDOW_MS))));
  return rows.map(({ createdAt }) => createdAt);
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

export async function readReportableAnswer(database: Database, viewerId: string, answerId: string) {
  const [target] = await database
    .select({ authorId: askAnswer.authorId, body: askAnswer.body, createdAt: askAnswer.createdAt, askTitle: ask.title })
    .from(askAnswer)
    .innerJoin(ask, eq(ask.id, askAnswer.askId))
    .innerJoin(user, eq(user.id, askAnswer.authorId))
    .where(and(eq(askAnswer.id, answerId), isActiveMember(), hasNoBlockBetween(viewerId, askAnswer.authorId), hasNoBlockBetween(viewerId, ask.authorId)));
  return target ?? null;
}

export type WordHelper = { memberId: string; sharedWords: string[] };

// Members whose "can help with" line or tags share a word with the ask, by the same rule the Today list uses
// (rules-help-match.ts). Plain word overlap, no AI. The most shared words first.
export async function readWordHelpers(database: Database, authorId: string, askText: string, now = new Date()): Promise<WordHelper[]> {
  if (readWords(askText).size === 0) return [];
  const rows = await database
    .select({ memberId: user.id, canHelpWith: memberProfile.canHelpWith, tag: memberTag.tag })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .leftJoin(memberTag, eq(memberTag.userId, user.id))
    .where(and(or(isNotNull(memberProfile.canHelpWith), isNotNull(memberTag.tag)), ne(user.id, authorId), isActiveMember(now), hasNoBlockBetween(authorId, user.id)));
  const textByMember = new Map<string, { canHelpWith: string; tags: string[] }>();
  for (const { memberId, canHelpWith, tag } of rows) {
    const entry = textByMember.get(memberId) ?? { canHelpWith: canHelpWith ?? "", tags: [] };
    if (tag) entry.tags.push(tag);
    textByMember.set(memberId, entry);
  }
  return [...textByMember]
    .flatMap(([memberId, { canHelpWith, tags }]) => {
      const sharedWords = findMatchedWords(askText, readWords([canHelpWith, ...tags].join(" ")));
      return sharedWords.length > 0 ? [{ memberId, sharedWords }] : [];
    })
    .toSorted((first, second) => second.sharedWords.length - first.sharedWords.length)
    .slice(0, ASK_LIMITS.wordHelpersPerAsk);
}
