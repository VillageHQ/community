import "server-only";

import { and, gte, lt, sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { ASK_CATEGORIES, ASK_OUTCOMES, type AskCategory } from "./contract.ts";
import { ask } from "./schema.ts";

// The partner report's breakdown by need: asks posted in a period per category, and how many were solved here.
// Counts only, never a title or an author.
export async function readAskNeedCounts(database: Database, { from, to }: { from: Date | null; to: Date | null }) {
  const rows = await database
    .select({
      category: ask.category,
      posted: sql<number>`count(*)`.mapWith(Number),
      solvedHere: sql<number>`count(*) filter (where ${ask.outcome} = ${ASK_OUTCOMES.solvedHere})`.mapWith(Number),
    })
    .from(ask)
    .where(and(from ? gte(ask.createdAt, from) : undefined, to ? lt(ask.createdAt, to) : undefined))
    .groupBy(ask.category);
  return Object.values(ASK_CATEGORIES).map((category: AskCategory) => {
    const row = rows.find((candidate) => candidate.category === category);
    return { category, posted: row?.posted ?? 0, solvedHere: row?.solvedHere ?? 0 };
  });
}
