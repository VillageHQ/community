import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { introRequest } from "./schema.ts";
import { INTRO_STATES, OPEN_INTRO_STATES } from "./contract.ts";
import { CLOSES_CONSENT } from "./reads.ts";

const WITHDRAWABLE_STATES = [INTRO_STATES.requested, INTRO_STATES.askingTarget];
const AGREED_STATES = [INTRO_STATES.accepted, INTRO_STATES.targetAgreed];

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function stopOpenAsksOnBlock(transaction: Transaction, blockerId: string, blockedId: string) {
  await transaction
    .update(introRequest)
    .set({ isWithheld: true })
    .where(
      and(
        eq(introRequest.introducerId, blockerId),
        eq(introRequest.requesterId, blockedId),
        inArray(introRequest.state, OPEN_INTRO_STATES),
      ),
    );
  await transaction
    .update(introRequest)
    .set({ state: INTRO_STATES.withdrawn, closedAt: new Date(), ...CLOSES_CONSENT })
    .where(
      and(
        eq(introRequest.requesterId, blockerId),
        eq(introRequest.introducerId, blockedId),
        inArray(introRequest.state, WITHDRAWABLE_STATES),
      ),
    );
  await transaction
    .update(introRequest)
    .set({ isWithheld: true })
    .where(
      and(
        eq(introRequest.requesterId, blockerId),
        eq(introRequest.introducerId, blockedId),
        inArray(introRequest.state, AGREED_STATES),
      ),
    );
}
