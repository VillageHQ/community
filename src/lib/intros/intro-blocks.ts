import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { introRequest } from "../../database/intro-schema.ts";
import { INTRO_STATES, OPEN_INTRO_STATES } from "./intro-api.ts";

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
    .set({ state: INTRO_STATES.withdrawn, closedAt: new Date() })
    .where(
      and(
        eq(introRequest.requesterId, blockerId),
        eq(introRequest.introducerId, blockedId),
        eq(introRequest.state, INTRO_STATES.requested),
      ),
    );
  await transaction
    .update(introRequest)
    .set({ isWithheld: true })
    .where(
      and(
        eq(introRequest.requesterId, blockerId),
        eq(introRequest.introducerId, blockedId),
        eq(introRequest.state, INTRO_STATES.accepted),
      ),
    );
}
