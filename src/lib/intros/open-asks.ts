import "server-only";

import { and, eq, gt, inArray } from "drizzle-orm";

import type { Database } from "../../database/client.ts";
import { introRequest } from "../../database/intro-schema.ts";
import { OPEN_INTRO_STATES, type IntroState } from "./intro-api.ts";

function toKnownState(state: string): IntroState {
  const known = OPEN_INTRO_STATES.find((openState) => openState === state);
  if (!known) throw new Error(`Unexpected open intro state: ${state}`);
  return known;
}

export async function readOpenAsks(database: Database, requesterId: string, targetSlug: string) {
  const asks = await database
    .select({ id: introRequest.id, state: introRequest.state, introducerId: introRequest.introducerId })
    .from(introRequest)
    .where(
      and(
        eq(introRequest.requesterId, requesterId),
        eq(introRequest.targetLinkedinSlug, targetSlug),
        inArray(introRequest.state, OPEN_INTRO_STATES),
        gt(introRequest.expiresAt, new Date()),
      ),
    );
  return new Map(asks.map(({ id, state, introducerId }) => [introducerId, { id, state: toKnownState(state) }]));
}
