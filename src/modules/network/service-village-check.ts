import "server-only";

import { isVillageError } from "@villagehq/sdk";
import { eq, lt } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import {
  createVillageLookupSession,
  createVillageSession,
  listVillageGroupIds,
  readVillageAppPublicKey,
  readVillageUser,
  type VillageConnection,
} from "../../platform/village/client.ts";
import { readVillageKeys } from "../../platform/village/settings.ts";
import { resolveVillageApiUrl } from "../../platform/village/urls.ts";
import { memberNetwork } from "../members/schema.ts";
import {
  MEMBER_CHECK_OUTCOMES,
  VILLAGE_CHECK_ERROR_CODES,
  VILLAGE_CHECK_GROUP,
  VILLAGE_CHECK_INTERVAL_MS,
  VILLAGE_CHECK_KEYS,
  type VillageCheckGroup,
  type VillageCheckKeys,
} from "./contract-village-check.ts";
import { villageCheck, villageMemberCheck } from "./schema.ts";
import { readVillageGroup, readVillageSearchSettings } from "./service-settings.ts";

const CHECK_ROW_ID = "latest";
const TOO_MANY_REQUESTS_STATUS = 429;
const PARALLEL_MEMBERS = 4;
// Each member gets its own short budget, so one slow answer can't use up the whole check.
const MEMBER_BUDGET_MS = 15_000;

type CheckedMember = { userId: string; externalId: string | null; email: string; hasReachedVillage: boolean };
type MemberResult = typeof villageMemberCheck.$inferInsert;

// Claims the one-a-minute slot in a single conditional write; a second click inside the minute finds nothing to claim.
async function claimCheck(database: Database, actorId: string, now: Date) {
  const claimed = await database
    .insert(villageCheck)
    .values({ id: CHECK_ROW_ID, startedAt: now, checkedById: actorId })
    .onConflictDoUpdate({
      target: villageCheck.id,
      set: { startedAt: now, checkedById: actorId },
      where: lt(villageCheck.startedAt, new Date(now.getTime() - VILLAGE_CHECK_INTERVAL_MS)),
    })
    .returning({ id: villageCheck.id });
  if (claimed.length > 0) return;
  throw new RequestError(TOO_MANY_REQUESTS_STATUS, VILLAGE_CHECK_ERROR_CODES.tooSoon, "Village was checked less than a minute ago. Try again in a minute.");
}

// Every active member. Only those who already reached Village through the join flow are asked about: asking about
// the others would send Village their email before they agreed to share.
async function readMembersToCheck(database: Database): Promise<CheckedMember[]> {
  const rows = await database
    .select({
      userId: user.id,
      email: user.email,
      externalId: memberNetwork.villageExternalId,
      sharingConsentedAt: memberNetwork.sharingConsentedAt,
      villageLinkedAt: memberNetwork.villageLinkedAt,
      groupJoinedAt: memberNetwork.groupJoinedAt,
    })
    .from(user)
    .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
    .where(isActiveMember());
  return rows.map(({ userId, email, externalId, sharingConsentedAt, villageLinkedAt, groupJoinedAt }) => ({
    userId,
    email,
    externalId,
    hasReachedVillage: externalId !== null && (sharingConsentedAt !== null || villageLinkedAt !== null || groupJoinedAt !== null),
  }));
}

async function checkKeys(connection: VillageConnection, publicKey: string, lookupEmail: string): Promise<VillageCheckKeys> {
  try {
    const session = createVillageLookupSession(connection, lookupEmail);
    return (await readVillageAppPublicKey(session)) === publicKey ? VILLAGE_CHECK_KEYS.ok : VILLAGE_CHECK_KEYS.mismatched;
  } catch (error) {
    return isVillageError(error, "unauthorized") || isVillageError(error, "forbidden") ? VILLAGE_CHECK_KEYS.rejected : VILLAGE_CHECK_KEYS.unreachable;
  }
}

async function checkMember(
  connection: Omit<VillageConnection, "deadlineAtMs">,
  overallDeadlineAtMs: number,
  groupId: string | null,
  member: CheckedMember,
): Promise<MemberResult> {
  const base = { userId: member.userId, isProvisioned: false, networkStatus: null, isInGroup: false };
  if (!member.hasReachedVillage || !member.externalId) return { ...base, outcome: MEMBER_CHECK_OUTCOMES.notStarted, checkedAt: new Date() };
  const deadlineAtMs = Math.min(overallDeadlineAtMs, Date.now() + MEMBER_BUDGET_MS);
  if (deadlineAtMs <= Date.now()) return { ...base, outcome: MEMBER_CHECK_OUTCOMES.unreachable, checkedAt: new Date() };
  try {
    const session = createVillageSession({ ...connection, deadlineAtMs }, { externalId: member.externalId, email: member.email });
    const villageUser = await readVillageUser(session);
    const isProvisioned = villageUser.email !== null;
    const isInGroup = isProvisioned && groupId !== null ? (await listVillageGroupIds(session)).includes(groupId) : false;
    return { ...base, outcome: MEMBER_CHECK_OUTCOMES.checked, isProvisioned, networkStatus: villageUser.status, isInGroup, checkedAt: new Date() };
  } catch {
    return { ...base, outcome: MEMBER_CHECK_OUTCOMES.unreachable, checkedAt: new Date() };
  }
}

async function checkMembers(
  connection: Omit<VillageConnection, "deadlineAtMs">,
  deadlineAtMs: number,
  groupId: string | null,
  members: CheckedMember[],
) {
  const results: MemberResult[] = [];
  const queue = [...members];
  const workers = Array.from({ length: PARALLEL_MEMBERS }, async () => {
    for (let member = queue.shift(); member; member = queue.shift()) results.push(await checkMember(connection, deadlineAtMs, groupId, member));
  });
  await Promise.all(workers);
  return results;
}

function readGroupState(groupId: string | null, results: MemberResult[]): VillageCheckGroup {
  if (groupId === null) return VILLAGE_CHECK_GROUP.none;
  return results.some(({ isInGroup }) => isInGroup) ? VILLAGE_CHECK_GROUP.found : VILLAGE_CHECK_GROUP.missing;
}

// Members Village wasn't asked about this time. Those who never started keep saying so.
function skipMembers(members: CheckedMember[]): MemberResult[] {
  return members.map(({ userId, hasReachedVillage }) => ({
    userId,
    outcome: hasReachedVillage ? MEMBER_CHECK_OUTCOMES.unreachable : MEMBER_CHECK_OUTCOMES.notStarted,
    checkedAt: new Date(),
  }));
}

async function saveCheck(database: Database, keys: VillageCheckKeys, group: VillageCheckGroup | null, results: MemberResult[], now: Date) {
  await database.transaction(async (transaction) => {
    await transaction.delete(villageMemberCheck);
    if (results.length > 0) await transaction.insert(villageMemberCheck).values(results);
    await transaction
      .update(villageCheck)
      .set({ checkedAt: now, keys, group, groupMemberCount: results.filter(({ isInGroup }) => isInGroup).length })
      .where(eq(villageCheck.id, CHECK_ROW_ID));
  });
}

// Only free calls: a token per member, the app (for the keys), each member's status and group list.
// Never search, paths or enrich.
export async function runVillageCheck({ database, environment, member, deadlineAtMs }: RequestContext) {
  const now = new Date();
  await claimCheck(database, member.id, now);

  const [keys, group, settings] = await Promise.all([readVillageKeys(database, environment), readVillageGroup(database), readVillageSearchSettings(database)]);
  const members = await readMembersToCheck(database);
  if (!keys) return saveCheck(database, VILLAGE_CHECK_KEYS.missing, null, skipMembers(members), now);

  const connection = { apiUrl: resolveVillageApiUrl(environment), secretKey: keys.secretKey };
  const keyDeadlineAtMs = Math.min(deadlineAtMs, Date.now() + MEMBER_BUDGET_MS);
  const keysState = await checkKeys({ ...connection, deadlineAtMs: keyDeadlineAtMs }, keys.publicKey, settings.serviceEmail ?? member.email);
  // With keys Village refuses, every member call would be refused too.
  if (keysState !== VILLAGE_CHECK_KEYS.ok) return saveCheck(database, keysState, null, skipMembers(members), new Date());

  const groupId = group?.id ?? null;
  const results = await checkMembers(connection, deadlineAtMs, groupId, members);
  await saveCheck(database, keysState, readGroupState(groupId, results), results, new Date());
}
