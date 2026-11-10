import "server-only";

import { and, eq, gt, gte, notInArray, or } from "drizzle-orm";

import type { DatabaseOrTransaction } from "../../platform/database/client.ts";
import { INTRO_STATES } from "./contract.ts";
import { introRequest } from "./schema.ts";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// An intro ask gives its place in the weekly allowance back when it ends without happening.
const RETURNED_STATES = [INTRO_STATES.declined, INTRO_STATES.targetDeclined, INTRO_STATES.withdrawn, INTRO_STATES.expired];
const OPEN_STATES = [INTRO_STATES.requested, INTRO_STATES.accepted, INTRO_STATES.askingTarget, INTRO_STATES.targetAgreed];

// When each intro ask the member sent in the last week was sent, minus those that came back. An open ask past its
// deadline counts as expired, even before the sweep marks it. Intros a helper offered don't count.
export async function readCountedIntroAskTimes(connection: DatabaseOrTransaction, memberId: string, now: Date) {
  const rows = await connection
    .select({ createdAt: introRequest.createdAt })
    .from(introRequest)
    .where(
      and(
        eq(introRequest.requesterId, memberId),
        eq(introRequest.isConnectorOffer, false),
        gte(introRequest.createdAt, new Date(now.getTime() - WEEK_MS)),
        notInArray(introRequest.state, RETURNED_STATES),
        or(notInArray(introRequest.state, OPEN_STATES), gt(introRequest.expiresAt, now)),
      ),
    );
  return rows.map(({ createdAt }) => createdAt);
}
