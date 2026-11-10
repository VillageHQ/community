import "server-only";

import { and, desc, eq, isNotNull, ne, notExists } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberProfile, memberTag } from "../members/schema.ts";
import { ASK_KINDS } from "./contract.ts";
import { helpableAskSchema, type HelpableAsk } from "./contract-today.ts";
import { hasNoBlockBetween, isOpenAsk } from "./reads.ts";
import { findMatchedWords, readWords } from "./rules-help-match.ts";
import { ask, askHelper, askOffer } from "./schema.ts";
import { askSkip } from "./schema-skip.ts";

// Enough recent asks to find a few good matches, without reading the whole board.
const CANDIDATE_ASKS = 100;
export const HELPABLE_ASKS_SHOWN = 5;

async function readHelperWords(database: Database, memberId: string) {
  const [[profile], tags] = await Promise.all([
    database.select({ canHelpWith: memberProfile.canHelpWith }).from(memberProfile).where(eq(memberProfile.userId, memberId)),
    database.select({ tag: memberTag.tag }).from(memberTag).where(eq(memberTag.userId, memberId)),
  ]);
  return readWords([profile?.canHelpWith ?? "", ...tags.map(({ tag }) => tag)].join(" "));
}

function hasNoAnswerFrom(memberId: string) {
  const offered = new QueryBuilder()
    .select({ askId: askOffer.askId })
    .from(askOffer)
    .where(and(eq(askOffer.askId, ask.id), eq(askOffer.helperId, memberId)));
  const skipped = new QueryBuilder()
    .select({ askId: askSkip.askId })
    .from(askSkip)
    .where(and(eq(askSkip.askId, ask.id), eq(askSkip.memberId, memberId)));
  return and(notExists(offered), notExists(skipped));
}

type CandidateRow = { id: string; title: string; detail: string | null; listedAt: Date; authorId: string; authorName: string; why: string | null };

// Asks, not updates, from other members, that this member can still answer. Blocks and removed members are
// left out, as on the board.
function selectCandidates(database: Database, memberId: string) {
  return database
    .select({ id: ask.id, title: ask.title, detail: ask.detail, listedAt: ask.listedAt, authorId: user.id, authorName: user.name, why: askHelper.why })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .leftJoin(askHelper, and(eq(askHelper.askId, ask.id), eq(askHelper.helperId, memberId)));
}

function candidateFilter(memberId: string, now: Date) {
  return and(eq(ask.kind, ASK_KINDS.ask), isOpenAsk(now), ne(ask.authorId, memberId), isActiveMember(now), hasNoBlockBetween(memberId, ask.authorId), hasNoAnswerFrom(memberId));
}

// Every ask this member was routed to (and emailed about) when it was posted, plus recent asks whose words meet
// their "can help with" words or tags by the same rule the routing uses, that they haven't offered on or skipped.
export async function readAsksYouCouldHelp(database: Database, memberId: string, now = new Date()): Promise<HelpableAsk[]> {
  const [helperWords, routed, recent] = await Promise.all([
    readHelperWords(database, memberId),
    selectCandidates(database, memberId).where(and(candidateFilter(memberId, now), isNotNull(askHelper.helperId))),
    selectCandidates(database, memberId).where(candidateFilter(memberId, now)).orderBy(desc(ask.listedAt), desc(ask.id)).limit(CANDIDATE_ASKS),
  ]);
  const rows = new Map<string, CandidateRow>([...recent, ...routed].map((row) => [row.id, row]));

  return [...rows.values()]
    .map((row) => ({ row, matchedWords: findMatchedWords(`${row.title} ${row.detail ?? ""}`, helperWords) }))
    .filter(({ row, matchedWords }) => row.why !== null || matchedWords.length > 0)
    .toSorted((first, second) => second.row.listedAt.getTime() - first.row.listedAt.getTime() || second.row.id.localeCompare(first.row.id))
    .slice(0, HELPABLE_ASKS_SHOWN)
    .map(({ row, matchedWords }) =>
      helpableAskSchema.parse({
        id: row.id,
        title: row.title,
        author: { id: row.authorId, name: row.authorName },
        listedAt: row.listedAt.toISOString(),
        matchedWords,
        why: row.why,
      }),
    );
}

// The same rules for one ask, so an answer from an email can't reach an ask the member no longer sees.
export async function isAskStillHelpable(database: Database, memberId: string, askId: string, now = new Date()) {
  const [row] = await database
    .select({ id: ask.id })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(and(eq(ask.id, askId), isOpenAsk(now), ne(ask.authorId, memberId), isActiveMember(now), hasNoBlockBetween(memberId, ask.authorId)));
  return Boolean(row);
}
