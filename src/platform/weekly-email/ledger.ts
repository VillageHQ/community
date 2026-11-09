import { and, eq } from "drizzle-orm";

import type { DatabaseOrTransaction } from "../database/client.ts";
import { weeklyEmail, weeklyEmailAction, type WeeklyEmailItem } from "./schema.ts";

export const WEEKLY_EMAIL_STATUSES = { queued: "queued", empty: "empty", notWanted: "not_wanted", test: "test" } as const;

export type WeeklyEmailStatus = (typeof WEEKLY_EMAIL_STATUSES)[keyof typeof WEEKLY_EMAIL_STATUSES];

// The confirm page's form field for the words that go with an answer, like a note with HELP.
export const WEEKLY_ANSWER_WORDS_FIELD = "words";

export const ACTION_SOURCES = { link: "link", reply: "reply" } as const;

export type ActionSource = (typeof ACTION_SOURCES)[keyof typeof ACTION_SOURCES];

// Claims this member's row for the week. Null means another run already did, so this one stops.
export async function claimWeeklyEmail(
  connection: DatabaseOrTransaction,
  { id, memberId, weekKey, status, items }: { id?: string; memberId: string; weekKey: string; status: WeeklyEmailStatus; items: WeeklyEmailItem[] },
) {
  const [claimed] = await connection
    .insert(weeklyEmail)
    .values({ id, memberId, weekKey, status, items })
    .onConflictDoNothing({ target: [weeklyEmail.memberId, weeklyEmail.weekKey] })
    .returning({ id: weeklyEmail.id });
  return claimed?.id ?? null;
}

export async function recordOutboxId(connection: DatabaseOrTransaction, weeklyEmailId: string, outboxId: string | null) {
  await connection.update(weeklyEmail).set({ outboxId }).where(eq(weeklyEmail.id, weeklyEmailId));
}

export async function readWeeklyEmail(connection: DatabaseOrTransaction, weeklyEmailId: string) {
  const [row] = await connection.select().from(weeklyEmail).where(eq(weeklyEmail.id, weeklyEmailId));
  return row ?? null;
}

export async function readItemAction(connection: DatabaseOrTransaction, weeklyEmailId: string, itemNumber: number) {
  const [row] = await connection
    .select({ action: weeklyEmailAction.action, via: weeklyEmailAction.via, createdAt: weeklyEmailAction.createdAt })
    .from(weeklyEmailAction)
    .where(and(eq(weeklyEmailAction.weeklyEmailId, weeklyEmailId), eq(weeklyEmailAction.itemNumber, itemNumber)));
  return row ?? null;
}

// True for the first answer to an item. Call it in the transaction that carries the answer out,
// so a failed answer leaves the item open and two answers at once can't both land.
export async function claimItemAction(
  connection: DatabaseOrTransaction,
  { weeklyEmailId, itemNumber, action, via }: { weeklyEmailId: string; itemNumber: number; action: string; via: ActionSource },
) {
  const claimed = await connection
    .insert(weeklyEmailAction)
    .values({ weeklyEmailId, itemNumber, action, via })
    .onConflictDoNothing()
    .returning({ itemNumber: weeklyEmailAction.itemNumber });
  return claimed.length > 0;
}

export async function releaseItemAction(connection: DatabaseOrTransaction, weeklyEmailId: string, itemNumber: number) {
  await connection.delete(weeklyEmailAction).where(and(eq(weeklyEmailAction.weeklyEmailId, weeklyEmailId), eq(weeklyEmailAction.itemNumber, itemNumber)));
}
