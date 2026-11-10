import "server-only";

import { and, eq, gt, inArray, or } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { introRequest } from "./schema.ts";
import { INTRO_STATES, OPEN_INTRO_STATES, readRequesterState } from "./contract.ts";

// An ask that ended in a no takes that connector off this requester's paths to that person. Both kinds of no count, as
// the requester sees them the same way: hiding only after a connector's no would tell them who answered.
const DECLINED_STATES = [INTRO_STATES.declined, INTRO_STATES.targetDeclined];

export async function readOpenAsks(database: Database, requesterId: string, targetSlug: string) {
  const asks = await database
    .select({ id: introRequest.id, state: introRequest.state, introducerId: introRequest.introducerId })
    .from(introRequest)
    .where(
      and(
        eq(introRequest.requesterId, requesterId),
        eq(introRequest.targetLinkedinSlug, targetSlug),
        or(and(inArray(introRequest.state, OPEN_INTRO_STATES), gt(introRequest.expiresAt, new Date())), inArray(introRequest.state, DECLINED_STATES)),
      ),
    );
  const isDeclined = (state: string) => DECLINED_STATES.some((declined) => declined === state);
  const open = asks.filter(({ state }) => !isDeclined(state));
  return {
    openByConnector: new Map(open.map(({ id, state, introducerId }) => [introducerId, { id, state: readRequesterState(state) }])),
    declinedConnectorIds: new Set(asks.filter(({ state }) => isDeclined(state)).map(({ introducerId }) => introducerId)),
  };
}
