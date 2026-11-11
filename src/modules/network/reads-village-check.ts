import "server-only";

import { asc, eq } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { isConnectedStatus, MEMBER_CHECK_OUTCOMES, VILLAGE_CHECK_INTERVAL_MS } from "./contract-village-check.ts";
import { villageCheck, villageMemberCheck } from "./schema.ts";

// The stored result of the last Village check. Reading it never calls Village.
export async function readVillageCheck(database: Database, now = new Date()) {
  const [check] = await database.select().from(villageCheck);
  const members = await database
    .select({
      userId: villageMemberCheck.userId,
      name: user.name,
      email: user.email,
      outcome: villageMemberCheck.outcome,
      isProvisioned: villageMemberCheck.isProvisioned,
      networkStatus: villageMemberCheck.networkStatus,
      isInGroup: villageMemberCheck.isInGroup,
      checkedAt: villageMemberCheck.checkedAt,
    })
    .from(villageMemberCheck)
    .innerJoin(user, eq(user.id, villageMemberCheck.userId))
    .where(isActiveMember(now))
    .orderBy(asc(user.name));
  const canCheckAgainAt = check ? new Date(check.startedAt.getTime() + VILLAGE_CHECK_INTERVAL_MS) : null;
  return { check: check?.checkedAt ? check : null, members, canCheckAgainAt };
}

export type VillageCheckRead = Awaited<ReturnType<typeof readVillageCheck>>;

export const OWN_VILLAGE_STATES = { connected: "connected", notConnected: "not_connected" } as const;

// The member's own line on Meet, from the last check. Null before any check reached them.
export async function readOwnVillageState(database: Database, userId: string) {
  const [row] = await database.select().from(villageMemberCheck).where(eq(villageMemberCheck.userId, userId));
  if (!row || row.outcome === MEMBER_CHECK_OUTCOMES.unreachable) return null;
  const isConnected = row.isProvisioned && isConnectedStatus(row.networkStatus) && row.isInGroup;
  return { state: isConnected ? OWN_VILLAGE_STATES.connected : OWN_VILLAGE_STATES.notConnected, checkedAt: row.checkedAt };
}
