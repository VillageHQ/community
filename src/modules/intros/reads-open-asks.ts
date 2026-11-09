import "server-only";

import { and, eq, gt, inArray } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { introRequest } from "./schema.ts";
import { OPEN_INTRO_STATES, readRequesterState } from "./contract.ts";

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
  return new Map(asks.map(({ id, state, introducerId }) => [introducerId, { id, state: readRequesterState(state) }]));
}
