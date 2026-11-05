import "server-only";

import { and, count, eq, isNotNull } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberNetwork } from "../members/schema.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { isAdminMember } from "../../platform/auth/roles.ts";
import { isMemberEmailTrusted } from "../members/service-linkedin.ts";
import { type SessionMember } from "../../platform/http/request-context.ts";
import { NETWORK_PROGRESS, type NetworkProgress } from "./contract-progress.ts";
import { readVillageGroup } from "./service-settings.ts";
import { readVillageKeys } from "../../platform/village/settings.ts";

const MAXIMUM_WELCOME_NEIGHBOURS = 6;

export { NETWORK_PROGRESS };

export async function readNetworkProgress(database: Database, member: SessionMember): Promise<NetworkProgress> {
  const keys = await readVillageKeys(database);
  if (!keys) return NETWORK_PROGRESS.notConfigured;
  if (!(await isMemberEmailTrusted(database, member))) return NETWORK_PROGRESS.needsEmailConfirmation;

  const [memberRow] = await database.select().from(memberNetwork).where(eq(memberNetwork.userId, member.id));
  if (!memberRow?.linkedinSlug) return NETWORK_PROGRESS.needsLinkedin;

  const group = await readVillageGroup(database);
  if (!group && !isAdminMember(member)) return NETWORK_PROGRESS.awaitingGroup;
  if (group && !memberRow.sharingConsentedAt) return NETWORK_PROGRESS.needsConsent;
  if (memberRow.pendingVillageEmail) return NETWORK_PROGRESS.needsApproval;
  if (group && memberRow.groupJoinedAt) return NETWORK_PROGRESS.ready;
  return NETWORK_PROGRESS.finishingJoin;
}

export async function readSharingMemberCount(database: Database) {
  const [row] = await database
    .select({ memberCount: count() })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(and(isNotNull(memberNetwork.groupJoinedAt), isActiveMember()));
  return row?.memberCount ?? 0;
}

export async function readWelcomeNeighbours(database: Database, excludedMemberId: string) {
  const neighbours = await database
    .select({ id: user.id, name: user.name })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(and(isNotNull(memberNetwork.groupJoinedAt), isActiveMember()))
    .limit(MAXIMUM_WELCOME_NEIGHBOURS + 1);
  return neighbours.filter(({ id }) => id !== excludedMemberId).slice(0, MAXIMUM_WELCOME_NEIGHBOURS);
}

export async function readPendingLinkCount(database: Database) {
  const [row] = await database
    .select({ pendingCount: count() })
    .from(memberNetwork)
    .where(isNotNull(memberNetwork.pendingVillageEmail));
  return row?.pendingCount ?? 0;
}

export async function readIsInVillageGroup(database: Database, memberId: string) {
  const [network] = await database.select({ groupJoinedAt: memberNetwork.groupJoinedAt }).from(memberNetwork).where(eq(memberNetwork.userId, memberId));
  return Boolean(network?.groupJoinedAt);
}
