import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";

import type { Transaction } from "../../platform/database/client.ts";
import { DELETED_MEMBER_NAME } from "../members/contract-privacy.ts";
import { INTRO_STATES, OPEN_INTRO_STATES } from "./contract.ts";
import { introRequest } from "./schema.ts";

export const ERASED_INTRO_TEXT = "(deleted)";
const SOMEONE = "Someone";

type ErasedMember = { memberId: string; linkedinSlugs: readonly string[] };

function placeholderSlug() {
  return sql`'deleted-' || ${introRequest.id}`;
}

// A deleted account: every intro they were part of stays as a row, so the partner report keeps its numbers, but
// loses the member's words and who they are. One still open is withdrawn, since it can't go on without them.
// The other member's own words stay, unless they are about the deleted member.
export async function anonymizeMemberIntros(transaction: Transaction, { memberId, linkedinSlugs }: ErasedMember) {
  const now = new Date();
  const asTarget = linkedinSlugs.length > 0 ? inArray(introRequest.targetLinkedinSlug, [...linkedinSlugs]) : sql`false`;
  const isPartOf = or(eq(introRequest.requesterId, memberId), eq(introRequest.introducerId, memberId), asTarget);

  await transaction
    .update(introRequest)
    .set({ state: INTRO_STATES.withdrawn, closedAt: now, targetEmail: null, requesterHasUpdate: false })
    .where(and(isPartOf, inArray(introRequest.state, [...OPEN_INTRO_STATES])));

  // As the one who asked: what they wrote, and whom they wanted to meet.
  await transaction
    .update(introRequest)
    .set({
      note: ERASED_INTRO_TEXT,
      reason: ERASED_INTRO_TEXT,
      declineReason: null,
      targetName: SOMEONE,
      targetHeadline: null,
      targetLinkedinSlug: placeholderSlug(),
      targetEmail: null,
    })
    .where(eq(introRequest.requesterId, memberId));
  // As the connector: their name, their LinkedIn address, the reason that names them, and their decline note.
  await transaction
    .update(introRequest)
    .set({
      introducerName: DELETED_MEMBER_NAME,
      introducerHeadline: null,
      introducerLinkedinSlug: placeholderSlug(),
      reason: ERASED_INTRO_TEXT,
      declineReason: null,
    })
    .where(eq(introRequest.introducerId, memberId));
  // As the person someone wanted to meet: who they are, and the note about them.
  await transaction
    .update(introRequest)
    .set({ targetName: SOMEONE, targetHeadline: null, targetLinkedinSlug: placeholderSlug(), targetEmail: null, note: ERASED_INTRO_TEXT })
    .where(asTarget);
}
