import "server-only";

import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { companyLogoColumn, filledFaceColumn, shownCompanyColumn, toShownFaceUrl } from "../members/reads-pictures.ts";
import { memberAvatar, memberProfile } from "../members/schema.ts";
import {
  ASK_ANSWER_KINDS,
  ASK_BOARD_TABS,
  ASK_HELPER_REASONS,
  ASK_KINDS,
  ASK_STATES,
  describeAskWho,
  describeWhyYou,
  type AskAnswerKind,
  type AskMember,
  type AskState,
  type AskTab,
} from "./contract.ts";
import { hasNoBlockBetween, isOpenAsk, readSearchWords } from "./reads.ts";
import { canRenewAsk, readAskState } from "./rules-state.ts";
import { ask, askAnswer, askHelper, askOffer } from "./schema.ts";

// Founderhall's Asks & updates and one ask's page, read on the server. The board's tabs: Open (open asks), Updates,
// Yours (the viewer's own), Answered (closed asks, the archive). A search looks through every ask and its answers.

const BOARD_LIMIT = 100;
const HELPER_FACES = 3;
const helperMember = alias(user, "helper_member");
const answerMember = alias(user, "answer_member");

type MemberColumns = { id: string; name: string; title: string | null; company: string | null; avatarUpdatedAt: Date | null; filledFace: string | null; companyLogoUrl: string | null };

function toMember({ id, name, title, company, avatarUpdatedAt, filledFace, companyLogoUrl }: MemberColumns): AskMember {
  return { id, name, title, company, avatarUrl: toShownFaceUrl(id, avatarUpdatedAt, filledFace), companyLogoUrl };
}

function memberColumns(table: { id: AnyPgColumn; name: AnyPgColumn }, id: AnyPgColumn) {
  return {
    id: sql<string>`${table.id}`,
    name: sql<string>`${table.name}`,
    title: memberProfile.title,
    company: shownCompanyColumn(id),
    avatarUpdatedAt: memberAvatar.updatedAt,
    filledFace: filledFaceColumn(id),
    companyLogoUrl: companyLogoColumn(id),
  };
}

export type PostHelper = {
  member: AskMember;
  reason: string;
  why: string;
  personName: string | null;
  personTitle: string | null;
  warmth: string | null;
  canAskForIntro: boolean;
};

export type PostAnswer = { id: string; author: AskMember; body: string; kind: AskAnswerKind; createdAt: string; isMine: boolean };

export type BoardPost = {
  id: string;
  body: string;
  kind: string;
  state: AskState;
  isPinned: boolean;
  isMine: boolean;
  author: AskMember;
  createdAt: string;
  who: string;
  targetText: string | null;
  targetCompany: string | null;
  helperCount: number;
  pathHelperCount: number;
  helperFaces: AskMember[];
  // The viewer is one of the helpers: Founderhall's "You could help." with the reason only they read.
  viewerWhyYou: string | null;
  viewerHasHelped: boolean;
  answerCount: number;
};

function selectPosts(database: Database) {
  return database
    .select({
      id: ask.id,
      title: ask.title,
      kind: ask.kind,
      listedAt: ask.listedAt,
      closedAt: ask.closedAt,
      createdAt: ask.createdAt,
      pinnedAt: ask.pinnedAt,
      targetText: ask.targetText,
      targetCompany: ask.targetCompany,
      targetName: ask.targetName,
      author: memberColumns(user, ask.authorId),
    })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .leftJoin(memberProfile, eq(memberProfile.userId, ask.authorId))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, ask.authorId));
}

type PostRow = Awaited<ReturnType<ReturnType<typeof selectPosts>["execute"]>>[number];

async function readHelpers(database: Database, askIds: string[], viewerId: string, now: Date) {
  const helpers = new Map<string, PostHelper[]>();
  if (askIds.length === 0) return helpers;
  const rows = await database
    .select({
      askId: askHelper.askId,
      reason: askHelper.reason,
      why: askHelper.why,
      personName: askHelper.personName,
      personTitle: askHelper.personTitle,
      warmth: askHelper.warmth,
      connectorSlug: askHelper.connectorSlug,
      member: memberColumns(helperMember, askHelper.helperId),
    })
    .from(askHelper)
    .innerJoin(helperMember, eq(helperMember.id, askHelper.helperId))
    .leftJoin(memberProfile, eq(memberProfile.userId, askHelper.helperId))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, askHelper.helperId))
    .where(and(inArray(askHelper.askId, askIds), isActiveMember(now, helperMember), hasNoBlockBetween(viewerId, askHelper.helperId)))
    .orderBy(asc(askHelper.reason), asc(askHelper.createdAt));
  for (const row of rows) {
    const list = helpers.get(row.askId) ?? [];
    list.push({
      member: toMember(row.member),
      reason: row.reason,
      why: row.why,
      personName: row.personName,
      personTitle: row.personTitle,
      warmth: row.warmth,
      // A path helper along the path; a helper found by profile words as a named intro (ASK-06).
      canAskForIntro: row.reason === ASK_HELPER_REASONS.words || row.connectorSlug !== null,
    });
    helpers.set(row.askId, list);
  }
  return helpers;
}

async function readAnswers(database: Database, askIds: string[], viewerId: string, now: Date) {
  const answers = new Map<string, PostAnswer[]>();
  if (askIds.length === 0) return answers;
  const rows = await database
    .select({ id: askAnswer.id, askId: askAnswer.askId, body: askAnswer.body, kind: askAnswer.kind, createdAt: askAnswer.createdAt, member: memberColumns(answerMember, askAnswer.authorId) })
    .from(askAnswer)
    .innerJoin(answerMember, eq(answerMember.id, askAnswer.authorId))
    .leftJoin(memberProfile, eq(memberProfile.userId, askAnswer.authorId))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, askAnswer.authorId))
    .where(and(inArray(askAnswer.askId, askIds), isActiveMember(now, answerMember), hasNoBlockBetween(viewerId, askAnswer.authorId)))
    .orderBy(asc(askAnswer.createdAt), asc(askAnswer.id));
  for (const row of rows) {
    const list = answers.get(row.askId) ?? [];
    list.push({ id: row.id, author: toMember(row.member), body: row.body, kind: row.kind as AskAnswerKind, createdAt: row.createdAt.toISOString(), isMine: row.member.id === viewerId });
    answers.set(row.askId, list);
  }
  return answers;
}

function toPost(row: PostRow, viewerId: string, helpers: PostHelper[], answers: PostAnswer[], now: Date): BoardPost {
  const state = readAskState(row, now);
  const isMine = row.author.id === viewerId;
  const viewerHelper = isMine ? null : helpers.find(({ member }) => member.id === viewerId);
  const isAsk = row.kind === ASK_KINDS.ask;
  return {
    id: row.id,
    body: row.title,
    kind: row.kind,
    state,
    isPinned: row.pinnedAt !== null && state === ASK_STATES.open,
    isMine,
    author: toMember(row.author),
    createdAt: row.createdAt.toISOString(),
    who: describeAskWho(row),
    targetText: row.targetText,
    targetCompany: row.targetCompany ?? null,
    helperCount: isAsk ? helpers.length : 0,
    pathHelperCount: isAsk ? helpers.filter(({ reason }) => reason === ASK_HELPER_REASONS.path).length : 0,
    helperFaces: helpers.slice(0, HELPER_FACES).map(({ member }) => member),
    viewerWhyYou: viewerHelper ? describeWhyYou(viewerHelper) : null,
    viewerHasHelped: answers.some(({ isMine: mine, kind }) => mine && kind !== ASK_ANSWER_KINDS.answer),
    answerCount: answers.length,
  };
}

function isOnTab(tab: AskTab, viewerId: string, now: Date): SQL | undefined {
  if (tab === ASK_BOARD_TABS.updates) return eq(ask.kind, ASK_KINDS.update);
  if (tab === ASK_BOARD_TABS.yours) return eq(ask.authorId, viewerId);
  if (tab === ASK_BOARD_TABS.answered) return and(eq(ask.kind, ASK_KINDS.ask), isNotNull(ask.closedAt));
  return and(eq(ask.kind, ASK_KINDS.ask), isOpenAsk(now));
}

function toContainsPattern(word: string) {
  return `%${word.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

// Every word in the ask, who it's trying to reach, the author's name, or an answer.
function matchesSearch(words: string[]) {
  return and(
    ...words.map((word) => {
      const pattern = toContainsPattern(word);
      const inAnswer = sql`exists (select 1 from ${askAnswer} where ${askAnswer.askId} = ${ask.id} and ${askAnswer.body} ilike ${pattern})`;
      return or(ilike(ask.title, pattern), ilike(ask.detail, pattern), ilike(ask.targetText, pattern), ilike(ask.targetCompany, pattern), ilike(user.name, pattern), inAnswer);
    }),
  );
}

export type AskTabCounts = Record<AskTab, number>;

async function readTabCounts(database: Database, viewerId: string, now: Date): Promise<AskTabCounts> {
  const visible = and(isActiveMember(now), hasNoBlockBetween(viewerId, ask.authorId));
  const [row] = await database
    .select({
      open: sql<number>`count(*) filter (where ${and(eq(ask.kind, ASK_KINDS.ask), isOpenAsk(now))})::int`,
      updates: sql<number>`count(*) filter (where ${eq(ask.kind, ASK_KINDS.update)})::int`,
      yours: sql<number>`count(*) filter (where ${eq(ask.authorId, viewerId)})::int`,
      answered: sql<number>`count(*) filter (where ${and(eq(ask.kind, ASK_KINDS.ask), isNotNull(ask.closedAt))})::int`,
    })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(visible);
  return { open: row?.open ?? 0, updates: row?.updates ?? 0, yours: row?.yours ?? 0, answered: row?.answered ?? 0 };
}

async function toPosts(database: Database, rows: PostRow[], viewerId: string, now: Date) {
  const askIds = rows.map(({ id }) => id);
  const [helpers, answers] = await Promise.all([readHelpers(database, askIds, viewerId, now), readAnswers(database, askIds, viewerId, now)]);
  return rows.map((row) => toPost(row, viewerId, helpers.get(row.id) ?? [], answers.get(row.id) ?? [], now));
}

export async function readAsksPage(database: Database, { viewerId, tab, search }: { viewerId: string; tab: AskTab; search: string | null }, now = new Date()) {
  const words = readSearchWords(search);
  const visible = and(isActiveMember(now), hasNoBlockBetween(viewerId, ask.authorId));
  const filter = words.length > 0 ? matchesSearch(words) : isOnTab(tab, viewerId, now);
  const pinnedFirst = sql`case when ${and(isNotNull(ask.pinnedAt), isNull(ask.closedAt))} then 0 else 1 end`;
  const [rows, counts] = await Promise.all([
    selectPosts(database).where(and(visible, filter)).orderBy(pinnedFirst, desc(ask.createdAt), desc(ask.id)).limit(BOARD_LIMIT),
    readTabCounts(database, viewerId, now),
  ]);
  return { posts: await toPosts(database, rows, viewerId, now), counts };
}

export type AskDetail = {
  post: BoardPost;
  helpers: PostHelper[];
  answers: PostAnswer[];
  // Offers made before "I can help" left a line under the ask: private, so only the author sees them.
  privateOffers: PostAnswer[];
  canReopen: boolean;
  canRenew: boolean;
};

// One ask as its page shows it, or null when the viewer may not see it.
export async function readAskDetail(database: Database, { viewerId, askId }: { viewerId: string; askId: string }, now = new Date()): Promise<AskDetail | null> {
  const [row] = await selectPosts(database).where(and(eq(ask.id, askId), isActiveMember(now), hasNoBlockBetween(viewerId, ask.authorId)));
  if (!row) return null;
  const [helpers, answers] = await Promise.all([readHelpers(database, [askId], viewerId, now), readAnswers(database, [askId], viewerId, now)]);
  const postHelpers = helpers.get(askId) ?? [];
  const postAnswers = answers.get(askId) ?? [];
  const post = toPost(row, viewerId, postHelpers, postAnswers, now);
  const privateOffers = post.isMine ? await readPrivateOffers(database, askId, viewerId, postAnswers, now) : [];
  return { post, helpers: post.kind === ASK_KINDS.ask ? postHelpers : [], answers: postAnswers, privateOffers, canReopen: post.state === ASK_STATES.closed, canRenew: post.isMine && canRenewAsk(row, now) };
}

async function readPrivateOffers(database: Database, askId: string, viewerId: string, answers: PostAnswer[], now: Date) {
  const helped = new Set(answers.filter(({ kind }) => kind !== ASK_ANSWER_KINDS.answer).map(({ author }) => author.id));
  const rows = await database
    .select({ id: askOffer.id, note: askOffer.note, createdAt: askOffer.createdAt, member: memberColumns(helperMember, askOffer.helperId) })
    .from(askOffer)
    .innerJoin(helperMember, eq(helperMember.id, askOffer.helperId))
    .leftJoin(memberProfile, eq(memberProfile.userId, askOffer.helperId))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, askOffer.helperId))
    .where(and(eq(askOffer.askId, askId), ne(askOffer.helperId, viewerId), isActiveMember(now, helperMember), hasNoBlockBetween(viewerId, askOffer.helperId)))
    .orderBy(asc(askOffer.createdAt));
  return rows
    .filter(({ member }) => !helped.has(member.id))
    .map((row) => ({ id: row.id, author: toMember(row.member), body: row.note, kind: ASK_ANSWER_KINDS.knowSomeone, createdAt: row.createdAt.toISOString(), isMine: false }) satisfies PostAnswer);
}

// "Your asks in motion" on Today: the viewer's open asks (not updates), newest first, with Founderhall's one line under each.
export async function readOpenOwnPosts(database: Database, viewerId: string, now = new Date()) {
  const rows = await selectPosts(database)
    .where(and(eq(ask.authorId, viewerId), eq(ask.kind, ASK_KINDS.ask), isOpenAsk(now)))
    .orderBy(desc(ask.createdAt), desc(ask.id))
    .limit(BOARD_LIMIT);
  return toPosts(database, rows, viewerId, now);
}

// The viewer as the ask parts draw a member (their face on a path).
export async function readAskMember(database: Database, memberId: string): Promise<AskMember | null> {
  const [row] = await database
    .select(memberColumns(user, user.id))
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
    .where(eq(user.id, memberId));
  return row ? toMember(row) : null;
}
