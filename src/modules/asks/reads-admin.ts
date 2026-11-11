import "server-only";

import { and, asc, desc, eq, exists, gte, isNotNull, lt, notExists, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { ASK_KINDS, ASK_LIMITS, ASK_OUTCOMES, ASK_STATES } from "./contract.ts";
import { readAskState } from "./rules-state.ts";
import { isOpenAsk } from "./reads.ts";
import { ask, askAnswer, askTally } from "./schema.ts";

type Period = { from: Date | null; to: Date | null };

export type AskAdminCounts = {
  asked: number;
  answered: number;
  closed: number;
  solvedHere: number;
  solvedElsewhere: number;
  noLongerNeeded: number;
};

function inPeriod(column: typeof ask.createdAt | typeof askTally.createdAt, { from, to }: Period) {
  return and(from ? gte(column, from) : undefined, to ? lt(column, to) : undefined);
}

const answerAuthor = alias(user, "answer_author");

// An answer members can see: its author is still an active member, as on the board.
function shownAnswers() {
  return new QueryBuilder()
    .select({ id: askAnswer.id })
    .from(askAnswer)
    .innerJoin(answerAuthor, eq(answerAuthor.id, askAnswer.authorId))
    .where(and(eq(askAnswer.askId, ask.id), isActiveMember(new Date(), answerAuthor)));
}

// Asks (not updates) posted in the period, counted like the partner report: a deleted account's asks count through
// their anonymous tally rows. "Answered" has at least one answer members can see; a tally row keeps no answers, so it never is.
export async function readAskAdminCounts(database: Database, period: Period): Promise<AskAdminCounts> {
  const outcomeCount = (column: typeof ask.outcome | typeof askTally.outcome, outcome: string) =>
    sql<number>`count(*) filter (where ${column} = ${outcome})`.mapWith(Number);
  const [[live], [tallied]] = await Promise.all([
    database
      .select({
        asked: sql<number>`count(*)`.mapWith(Number),
        answered: sql<number>`count(*) filter (where ${exists(shownAnswers())})`.mapWith(Number),
        closed: sql<number>`count(*) filter (where ${ask.outcome} is not null)`.mapWith(Number),
        solvedHere: outcomeCount(ask.outcome, ASK_OUTCOMES.solvedHere),
        solvedElsewhere: outcomeCount(ask.outcome, ASK_OUTCOMES.solvedElsewhere),
        noLongerNeeded: outcomeCount(ask.outcome, ASK_OUTCOMES.noLongerNeeded),
      })
      .from(ask)
      .where(and(eq(ask.kind, ASK_KINDS.ask), inPeriod(ask.createdAt, period))),
    database
      .select({
        asked: sql<number>`count(*)`.mapWith(Number),
        closed: sql<number>`count(*) filter (where ${askTally.outcome} is not null)`.mapWith(Number),
        solvedHere: outcomeCount(askTally.outcome, ASK_OUTCOMES.solvedHere),
        solvedElsewhere: outcomeCount(askTally.outcome, ASK_OUTCOMES.solvedElsewhere),
        noLongerNeeded: outcomeCount(askTally.outcome, ASK_OUTCOMES.noLongerNeeded),
      })
      .from(askTally)
      .where(and(eq(askTally.kind, ASK_KINDS.ask), inPeriod(askTally.createdAt, period))),
  ]);
  return {
    asked: (live?.asked ?? 0) + (tallied?.asked ?? 0),
    answered: live?.answered ?? 0,
    closed: (live?.closed ?? 0) + (tallied?.closed ?? 0),
    solvedHere: (live?.solvedHere ?? 0) + (tallied?.solvedHere ?? 0),
    solvedElsewhere: (live?.solvedElsewhere ?? 0) + (tallied?.solvedElsewhere ?? 0),
    noLongerNeeded: (live?.noLongerNeeded ?? 0) + (tallied?.noLongerNeeded ?? 0),
  };
}

export type AdminAskLine = { id: string; title: string; authorName: string; listedAt: string; isPinned: boolean; isExpired: boolean };

function selectAdminAskLines(database: Database) {
  return database
    .select({ id: ask.id, title: ask.title, authorName: user.name, listedAt: ask.listedAt, pinnedAt: ask.pinnedAt })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId));
}

type LineRow = { id: string; title: string; authorName: string; listedAt: Date; pinnedAt: Date | null };

function toLine({ id, title, authorName, listedAt, pinnedAt }: LineRow, now: Date): AdminAskLine {
  const isExpired = readAskState({ listedAt, closedAt: null }, now) === ASK_STATES.expired;
  return { id, title, authorName, listedAt: listedAt.toISOString(), isPinned: pinnedAt !== null, isExpired };
}

// Open asks nobody has answered yet, the longest waiting first. Members see all of them on the board already.
export async function readOldestUnansweredAsks(database: Database, now = new Date()) {
  const noAnswer = notExists(shownAnswers());
  const rows = await selectAdminAskLines(database)
    .where(and(eq(ask.kind, ASK_KINDS.ask), isOpenAsk(now), isActiveMember(now), noAnswer))
    .orderBy(asc(ask.listedAt), asc(ask.id))
    .limit(ASK_LIMITS.adminOldestShown);
  return rows.map((row) => toLine(row, now));
}

// Every pinned ask, an expired one too: it keeps its place until it's unpinned, renewed or closed.
export async function readPinnedAskLines(database: Database, now = new Date()) {
  const rows = await selectAdminAskLines(database).where(isNotNull(ask.pinnedAt)).orderBy(desc(ask.pinnedAt), desc(ask.id));
  return rows.map((row) => toLine(row, now));
}
