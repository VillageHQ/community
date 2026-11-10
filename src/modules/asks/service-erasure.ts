import "server-only";

import { eq, inArray, or } from "drizzle-orm";

import type { Transaction } from "../../platform/database/client.ts";
import { ask, askAnswer, askHelper, askOffer, askTally } from "./schema.ts";
import { askSkip } from "./schema-skip.ts";

type ErasedMember = { memberId: string; linkedinSlugs: readonly string[] };

// A deleted account: its asks become anonymous tally rows (so the partner report keeps its numbers), and every ask,
// offer, answer, helper line and skip of theirs goes. No copy of the words is kept anywhere.
export async function eraseMemberAsks(transaction: Transaction, { memberId, linkedinSlugs }: ErasedMember) {
  const asks = await transaction
    .select({ category: ask.category, kind: ask.kind, outcome: ask.outcome, createdAt: ask.createdAt })
    .from(ask)
    .where(eq(ask.authorId, memberId));
  if (asks.length > 0) await transaction.insert(askTally).values(asks);

  await transaction.delete(ask).where(eq(ask.authorId, memberId));
  await transaction.delete(askOffer).where(eq(askOffer.helperId, memberId));
  await transaction.delete(askAnswer).where(eq(askAnswer.authorId, memberId));
  // A helper line on someone else's ask that names them as the connector holds their name in its "why".
  await transaction
    .delete(askHelper)
    .where(linkedinSlugs.length > 0 ? or(eq(askHelper.helperId, memberId), inArray(askHelper.connectorSlug, [...linkedinSlugs])) : eq(askHelper.helperId, memberId));
  await transaction.delete(askSkip).where(eq(askSkip.memberId, memberId));
}
