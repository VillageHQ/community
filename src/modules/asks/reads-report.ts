import "server-only";

import { and, gte, lt, sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { ASK_CATEGORIES, ASK_OUTCOMES, type AskCategory } from "./contract.ts";
import { ask, askTally } from "./schema.ts";

type Period = { from: Date | null; to: Date | null };

function readLiveCounts(database: Database, { from, to }: Period) {
  return database
    .select({
      category: ask.category,
      posted: sql<number>`count(*)`.mapWith(Number),
      solvedHere: sql<number>`count(*) filter (where ${ask.outcome} = ${ASK_OUTCOMES.solvedHere})`.mapWith(Number),
    })
    .from(ask)
    .where(and(from ? gte(ask.createdAt, from) : undefined, to ? lt(ask.createdAt, to) : undefined))
    .groupBy(ask.category);
}

function readTalliedCounts(database: Database, { from, to }: Period) {
  return database
    .select({
      category: askTally.category,
      posted: sql<number>`count(*)`.mapWith(Number),
      solvedHere: sql<number>`count(*) filter (where ${askTally.outcome} = ${ASK_OUTCOMES.solvedHere})`.mapWith(Number),
    })
    .from(askTally)
    .where(and(from ? gte(askTally.createdAt, from) : undefined, to ? lt(askTally.createdAt, to) : undefined))
    .groupBy(askTally.category);
}

// The partner report's breakdown by need: asks posted in a period per category, and how many were solved here.
// Counts only, never a title or an author. Asks of deleted accounts count through their anonymous tally rows.
export async function readAskNeedCounts(database: Database, period: Period) {
  const [live, tallied] = await Promise.all([readLiveCounts(database, period), readTalliedCounts(database, period)]);
  const rows = [...live, ...tallied];
  return Object.values(ASK_CATEGORIES).map((category: AskCategory) => {
    const matching = rows.filter((candidate) => candidate.category === category);
    return {
      category,
      posted: matching.reduce((total, row) => total + row.posted, 0),
      solvedHere: matching.reduce((total, row) => total + row.solvedHere, 0),
    };
  });
}
