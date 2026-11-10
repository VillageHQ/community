import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";

import type { Database } from "@/platform/database/client";
import type { Environment } from "@/platform/environment";

import { CHAT_KINDS, CHAT_LIMITS, CHAT_POST_STATUSES, type ChatKind } from "./contract";
import { chatConnection, chatPost } from "./schema";
import { sendToChannel } from "./service";

// A claim left "sending" this long belongs to a run that died before it finished, so it may be taken again.
const STALE_SENDING_INTERVAL = sql.raw("interval '10 minutes'");

// One thing to post: a name for the ledger, when it happened, and its words for each tool. Only channels posting since
// before `happenedAt` get it, so connecting or resuming a channel doesn't flood it with old items.
export type ChatItem = { ref: string; happenedAt: Date; compose: (kind: ChatKind) => string };

export type PostOutcome = { kind: ChatKind; ref: string; result: "sent" | "failed" | "skipped" };

// Channels posts go to now: connected, with a channel, not paused, and the token not refused.
export async function readPostingChannels(database: Database) {
  const rows = await database
    .select({ kind: chatConnection.kind, postsFromAt: chatConnection.postsFromAt })
    .from(chatConnection)
    .where(and(isNotNull(chatConnection.channelId), eq(chatConnection.isPaused, false), eq(chatConnection.isRefused, false)));
  return rows.flatMap(({ kind, postsFromAt }) => (kind === CHAT_KINDS.slack || kind === CHAT_KINDS.discord ? [{ kind, postsFromAt }] : []));
}

// True the first time, and again after a failure (up to the attempt limit) or a claim that died. False once it's sent
// or while another run sends it.
async function claimPost(database: Database, kind: ChatKind, ref: string) {
  const claimed = await database
    .insert(chatPost)
    .values({ kind, ref, status: CHAT_POST_STATUSES.sending })
    .onConflictDoUpdate({
      target: [chatPost.kind, chatPost.ref],
      set: { status: CHAT_POST_STATUSES.sending, attempts: sql`${chatPost.attempts} + 1`, error: null, updatedAt: sql`now()` },
      setWhere: sql`${chatPost.attempts} < ${CHAT_LIMITS.postAttempts} and (${chatPost.status} = ${CHAT_POST_STATUSES.failed} or (${chatPost.status} = ${CHAT_POST_STATUSES.sending} and ${chatPost.updatedAt} < now() - ${STALE_SENDING_INTERVAL}))`,
    })
    .returning({ ref: chatPost.ref });
  return claimed.length > 0;
}

async function finishPost(database: Database, kind: ChatKind, ref: string, error: string | null) {
  await database
    .update(chatPost)
    .set({ status: error ? CHAT_POST_STATUSES.failed : CHAT_POST_STATUSES.sent, error, updatedAt: sql`now()` })
    .where(and(eq(chatPost.kind, kind), eq(chatPost.ref, ref)));
}

// Each item to each posting channel, once. A refused token stops that channel until the admin pastes a new one.
export async function postChatItems(database: Database, environment: Environment, items: readonly ChatItem[]) {
  const outcomes: PostOutcome[] = [];
  for (const { kind, postsFromAt } of await readPostingChannels(database)) {
    for (const item of items) {
      if (item.happenedAt < postsFromAt || !(await claimPost(database, kind, item.ref))) {
        outcomes.push({ kind, ref: item.ref, result: "skipped" });
        continue;
      }
      const { error, isRefused } = await sendToChannel(database, environment, kind, item.compose(kind));
      await finishPost(database, kind, item.ref, error);
      outcomes.push({ kind, ref: item.ref, result: error ? "failed" : "sent" });
      if (isRefused) break;
    }
  }
  return outcomes;
}

export async function readPostLedger(database: Database) {
  return database.select().from(chatPost);
}
