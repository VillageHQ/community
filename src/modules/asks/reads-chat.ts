import "server-only";

import { and, desc, eq, gte, isNull, notExists, or, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { isListedInDirectory } from "../members/reads-directory.ts";
import { memberBlock } from "../members/schema.ts";
import { ASK_KINDS } from "./contract.ts";
import { ask } from "./schema.ts";

const MAXIMUM_ASKS = 50;

// A chat channel is read by everyone in it, so a block can't be applied per reader. An author who blocked someone,
// or was blocked, has their asks kept out of chat altogether. Nobody is told.
function authorHasNoBlock() {
  const block = new QueryBuilder()
    .select({ blockerId: memberBlock.blockerId })
    .from(memberBlock)
    .where(or(eq(memberBlock.blockerId, ask.authorId), eq(memberBlock.blockedId, ask.authorId)));
  return notExists(block);
}

// Open asks (not updates) by active members, posted since `since`: the newest 50, returned oldest first, so a busy
// community never holds new asks back behind ones already posted. Only what any member sees on the
// board: the title and the author's name.
export async function readAsksForChat(database: Database, since: Date, now = new Date()) {
  const newest = await database
    .select({
      id: ask.id,
      title: ask.title,
      createdAt: ask.createdAt,
      authorName: user.name,
      isAuthorListed: sql<boolean>`coalesce(${isListedInDirectory(now)}, false)`,
    })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(and(eq(ask.kind, ASK_KINDS.ask), isNull(ask.closedAt), gte(ask.createdAt, since), isActiveMember(now), authorHasNoBlock()))
    .orderBy(desc(ask.createdAt), desc(ask.id))
    .limit(MAXIMUM_ASKS);
  return newest.toReversed();
}
