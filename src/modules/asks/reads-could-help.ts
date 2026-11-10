import "server-only";

import { and, desc, eq, ne, notExists } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberProfile, memberTag } from "../members/schema.ts";
import { helpableAskSchema, type HelpableAsk } from "./contract-today.ts";
import { hasNoBlockBetween, isOpenAsk } from "./reads.ts";
import { findMatchedWords, readWords } from "./rules-help-match.ts";
import { ask, askOffer } from "./schema.ts";
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

// Open asks from other members whose words meet this member's "can help with" words or tags, and
// that they haven't offered on or skipped. Blocks and removed members are left out, as on the board.
export async function readAsksYouCouldHelp(database: Database, memberId: string, now = new Date()): Promise<HelpableAsk[]> {
  const helperWords = await readHelperWords(database, memberId);
  if (helperWords.size === 0) return [];
  const rows = await database
    .select({ id: ask.id, title: ask.title, detail: ask.detail, listedAt: ask.listedAt, authorId: user.id, authorName: user.name })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(and(isOpenAsk(now), ne(ask.authorId, memberId), isActiveMember(now), hasNoBlockBetween(memberId, ask.authorId), hasNoAnswerFrom(memberId)))
    .orderBy(desc(ask.listedAt), desc(ask.id))
    .limit(CANDIDATE_ASKS);

  return rows
    .map((row) => ({ row, matchedWords: findMatchedWords(`${row.title} ${row.detail ?? ""}`, helperWords) }))
    .filter(({ matchedWords }) => matchedWords.length > 0)
    .slice(0, HELPABLE_ASKS_SHOWN)
    .map(({ row, matchedWords }) =>
      helpableAskSchema.parse({
        id: row.id,
        title: row.title,
        author: { id: row.authorId, name: row.authorName },
        listedAt: row.listedAt.toISOString(),
        matchedWords,
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
