import "server-only";

import type { GroupLeaveOutcome } from "@villagehq/sdk";
import { eq } from "drizzle-orm";

import { memberRemoval, memberNetwork } from "../members/schema.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { GROUP_DEPARTURE_OUTCOMES, type GroupDepartureOutcome } from "./contract.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { createVillageSession, leaveVillageGroup, readVillageUser } from "../../platform/village/client.ts";
import { leaveSearchIdentityForLastMember } from "./service-search-pool.ts";
import { clearMemberFromGroup } from "./service.ts";
import { type RequestContext } from "../../platform/http/request-context.ts";
import { readVillageGroup, type VillageGroup } from "./service-settings.ts";
import { readVillageKeys, type VillageKeys } from "../../platform/village/settings.ts";
import { resolveVillageApiUrl } from "../../platform/village/urls.ts";

const DEPARTURE_DEADLINE_MS = 20_000;

const DEPARTURE_FROM_VILLAGE_OUTCOME: Record<GroupLeaveOutcome, GroupDepartureOutcome> = {
  left: GROUP_DEPARTURE_OUTCOMES.left,
  not_member: GROUP_DEPARTURE_OUTCOMES.left,
  admin_blocked: GROUP_DEPARTURE_OUTCOMES.creatorRefused,
};

type DepartingMember = { memberId: string; email: string };
type DepartureAttempt = {
  context: RequestContext;
  keys: VillageKeys;
  group: VillageGroup;
  externalId: string;
  memberId: string;
  email: string;
  approvedVillageEmail: string | null;
};

function isOwnVillageAccount(villageEmail: string, { email, approvedVillageEmail }: Pick<DepartureAttempt, "email" | "approvedVillageEmail">) {
  const normalized = villageEmail.trim().toLowerCase();
  return normalized === email.trim().toLowerCase() || normalized === approvedVillageEmail;
}

async function leaveAs(attempt: DepartureAttempt): Promise<GroupDepartureOutcome> {
  const { context, keys, group, externalId, email } = attempt;
  const session = createVillageSession(
    { apiUrl: resolveVillageApiUrl(context.environment), secretKey: keys.secretKey, deadlineAtMs: Date.now() + DEPARTURE_DEADLINE_MS },
    { externalId, email },
  );
  const { email: villageEmail } = await readVillageUser(session);
  if (villageEmail === null || !isOwnVillageAccount(villageEmail, attempt)) return GROUP_DEPARTURE_OUTCOMES.failed;
  const outcome = await leaveVillageGroup(session, group.id);
  // The search identity alone in the group still blocks its creator from leaving: it leaves first.
  if (outcome === "admin_blocked" && (await leaveSearchIdentityForLastMember(context, keys, group, attempt.memberId))) {
    return DEPARTURE_FROM_VILLAGE_OUTCOME[await leaveVillageGroup(session, group.id)];
  }
  return DEPARTURE_FROM_VILLAGE_OUTCOME[outcome];
}

async function leaveOrFail(attempt: DepartureAttempt) {
  try {
    return await leaveAs(attempt);
  } catch (error) {
    logError("group-departure", error);
    return GROUP_DEPARTURE_OUTCOMES.failed;
  }
}

function readWorstOutcome(outcomes: GroupDepartureOutcome[]) {
  if (outcomes.includes(GROUP_DEPARTURE_OUTCOMES.failed)) return GROUP_DEPARTURE_OUTCOMES.failed;
  if (outcomes.includes(GROUP_DEPARTURE_OUTCOMES.creatorRefused)) return GROUP_DEPARTURE_OUTCOMES.creatorRefused;
  return GROUP_DEPARTURE_OUTCOMES.left;
}

async function attemptDeparture(context: RequestContext, { memberId, email }: DepartingMember): Promise<GroupDepartureOutcome | null> {
  const { database } = context;
  const [network] = await database.select().from(memberNetwork).where(eq(memberNetwork.userId, memberId));
  if (!network?.groupJoinedAt && !network?.staleGroupExternalId) return null;

  const [keys, group] = await Promise.all([readVillageKeys(database), readVillageGroup(database)]);
  if (!keys || !group) return GROUP_DEPARTURE_OUTCOMES.failed;

  const shared = { context, keys, group, memberId, email, approvedVillageEmail: network.approvedVillageEmail };
  const currentOutcome = network.groupJoinedAt ? await leaveOrFail({ ...shared, externalId: network.villageExternalId }) : GROUP_DEPARTURE_OUTCOMES.left;
  const staleOutcome = network.staleGroupExternalId ? await leaveOrFail({ ...shared, externalId: network.staleGroupExternalId }) : GROUP_DEPARTURE_OUTCOMES.left;

  if (staleOutcome === GROUP_DEPARTURE_OUTCOMES.left) {
    await database.update(memberNetwork).set({ staleGroupExternalId: null }).where(eq(memberNetwork.userId, memberId));
  }
  if (network.groupJoinedAt && currentOutcome === GROUP_DEPARTURE_OUTCOMES.left) await clearMemberFromGroup(database, memberId);
  return readWorstOutcome([currentOutcome, staleOutcome]);
}

async function recordDeparture(context: RequestContext, memberId: string, memberName: string, outcome: GroupDepartureOutcome) {
  await context.database.transaction(async (transaction) => {
    await transaction.update(memberRemoval).set({ villageLeaveOutcome: outcome }).where(eq(memberRemoval.userId, memberId));
    await recordAdminAction(transaction, context.member.id, {
      action: AUDIT_ACTIONS.villageGroupLeft,
      targetMemberId: memberId,
      targetName: memberName,
      detail: outcome,
    });
  });
}

// Runs after the removal commits, and never throws: Village being down must not stop someone being removed here.
export async function leaveGroupOnBehalf(context: RequestContext, member: DepartingMember & { memberName: string }) {
  try {
    const outcome = await attemptDeparture(context, member);
    if (outcome) await recordDeparture(context, member.memberId, member.memberName, outcome);
    return outcome;
  } catch (error) {
    logError("group-departure", error);
    return GROUP_DEPARTURE_OUTCOMES.failed;
  }
}

export const DEPARTURE_SENTENCES: Record<GroupDepartureOutcome, (name: string) => string> = {
  [GROUP_DEPARTURE_OUTCOMES.left]: () =>
    "We also took them out of the Village group, so their network stops being shared from now on. Anyone who already saw results through them can't unsee those.",
  [GROUP_DEPARTURE_OUTCOMES.creatorRefused]: (name) =>
    `Village refused to take ${name} out of the group, because they created it and other members are still in it. Their network stays shared through Village until everyone else leaves.`,
  [GROUP_DEPARTURE_OUTCOMES.failed]: (name) =>
    `We couldn't take ${name} out of the Village group, so their network is still shared through Village. Try again from their row in Members. Otherwise they have to leave inside Village.`,
};
