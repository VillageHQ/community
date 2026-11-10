import "server-only";

import { eq } from "drizzle-orm";

import { memberNetwork } from "../members/schema.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { cancelVillageUser } from "../../platform/village/client.ts";
import { readVillageKeys } from "../../platform/village/settings.ts";
import { resolveVillageApiUrl } from "../../platform/village/urls.ts";
import { type GroupDepartureOutcome } from "./contract.ts";
import { leaveGroupOnBehalf } from "./service-departure.ts";

const CANCEL_DEADLINE_MS = 20_000;

export const VILLAGE_CANCEL_OUTCOMES = { cancelled: "cancelled", failed: "failed" } as const;
export type VillageCancelOutcome = (typeof VILLAGE_CANCEL_OUTCOMES)[keyof typeof VILLAGE_CANCEL_OUTCOMES];

export type VillageErasure = { groupOutcome: GroupDepartureOutcome | null; cancelOutcome: VillageCancelOutcome | null };

type ErasingMember = { memberId: string; memberName: string; email: string };

// Every Village identity this site ever used for the member: the current one once they agreed to network search,
// and an older one left over from a reset link.
function readVillageIdentities(network: typeof memberNetwork.$inferSelect | undefined) {
  if (!network) return [];
  const isCurrentUsed = Boolean(network.sharingConsentedAt ?? network.villageLinkedAt ?? network.groupJoinedAt);
  return [...(isCurrentUsed ? [network.villageExternalId] : []), ...(network.staleGroupExternalId ? [network.staleGroupExternalId] : [])];
}

async function cancelIdentities(context: RequestContext, externalIds: readonly string[], email: string): Promise<VillageCancelOutcome | null> {
  if (externalIds.length === 0) return null;
  const keys = await readVillageKeys(context.database);
  if (!keys) return VILLAGE_CANCEL_OUTCOMES.failed;
  const connection = { apiUrl: resolveVillageApiUrl(context.environment), secretKey: keys.secretKey, deadlineAtMs: Date.now() + CANCEL_DEADLINE_MS };
  let outcome: VillageCancelOutcome = VILLAGE_CANCEL_OUTCOMES.cancelled;
  for (const externalId of externalIds) {
    try {
      await cancelVillageUser(connection, { externalId, email });
    } catch (error) {
      logError("village-user-cancel", error);
      outcome = VILLAGE_CANCEL_OUTCOMES.failed;
    }
  }
  return outcome;
}

// Runs before the local delete, while the member's Village identity is still known: leave the group, then cancel the
// Village user so its tokens stop working. Never throws: Village being down must not stop a deletion.
export async function eraseFromVillage(context: RequestContext, member: ErasingMember): Promise<VillageErasure> {
  try {
    const [network] = await context.database.select().from(memberNetwork).where(eq(memberNetwork.userId, member.memberId));
    const identities = readVillageIdentities(network);
    const groupOutcome = await leaveGroupOnBehalf(context, member);
    return { groupOutcome, cancelOutcome: await cancelIdentities(context, identities, member.email) };
  } catch (error) {
    logError("village-erasure", error);
    return { groupOutcome: null, cancelOutcome: VILLAGE_CANCEL_OUTCOMES.failed };
  }
}
