import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, isNotNull, or, sql } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberNetwork } from "../members/schema.ts";
import { memberPathResult } from "./schema.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import {
  createVillageGroup,
  createVillageSession,
  isVillageErrorStatus,
  joinVillageGroup,
  leaveVillageGroup,
  NETWORK_SOURCE,
  readVillageAppPublicKey,
  readVillagePaths,
  readVillageUser,
  searchVillageNetwork,
  VILLAGE_FAILURE_TYPES,
  VILLAGE_LEAVE_OUTCOMES,
  VILLAGE_NOT_FOUND_STATUS,
  VILLAGE_UNAUTHORIZED_STATUS,
  VillageApiError,
  type VillagePaths,
  type VillageSession,
  villagePathsSchema,
} from "../../platform/village/client.ts";
import { cleanVillageText } from "./rules-connector-reason.ts";
import { CREDIT_CALL_KINDS, readDailyLookupsLeft, withCreditCall } from "../../platform/village/credit-ledger.ts";
import { readLinkedinSlug, toLinkedinUrl } from "../members/contract-linkedin.ts";
import {
  describeMemberPaths,
  readConnectors,
  readPathSlugs,
  readTargetName,
  readTrustedMember,
  type ConnectorDraft,
  type MemberPathsFacts,
} from "./rules-paths.ts";
import {
  CONNECTOR_ERROR_CODES,
  CONNECTOR_LIMITS,
  NETWORK_ERROR_CODES,
  NETWORK_STAGES,
  type NetworkSearchResult,
  type NetworkStage,
  type NetworkStatus,
} from "./contract.ts";
import { deleteVillageGroup, readVillageGroup, saveVillageGroup } from "./service-settings.ts";
import { readVillageKeys, saveVillageKeys, type VillageKeys } from "../../platform/village/settings.ts";
import { readReachableMembers } from "./reads-reachable-members.ts";
import { resolveVillageApiUrl, resolveVillageSdkUrl } from "../../platform/village/urls.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import type { SessionMember, RequestContext } from "../../platform/http/request-context.ts";
import { isAdminMember } from "../../platform/auth/roles.ts";
import { ensureMemberNetwork, normalizeEmail, isMemberEmailTrusted } from "../members/service-linkedin.ts";

const PATH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const INTERNAL_ERROR_STATUS = 500;
const SERVICE_UNAVAILABLE_STATUS = 503;
const GATEWAY_TIMEOUT_STATUS = 504;
const SEARCH_CUT_OFF_TYPES: ReadonlySet<string> = new Set([
  VILLAGE_FAILURE_TYPES.timedOut,
  VILLAGE_FAILURE_TYPES.invalidResponse,
  VILLAGE_FAILURE_TYPES.unreadableError,
]);

type MemberNetworkRow = typeof memberNetwork.$inferSelect;

function emailNotConfirmedError() {
  return new RequestError(
    CONFLICT_STATUS,
    NETWORK_ERROR_CODES.emailNotConfirmed,
    "We need to confirm this email is yours before you can use network search.",
  );
}

async function connectMember(
  { database, environment, member, deadlineAtMs }: RequestContext,
  keys: VillageKeys,
) {
  if (!(await isMemberEmailTrusted(database, member))) throw emailNotConfirmedError();

  const network = await ensureMemberNetwork(database, member.id);
  const session = createVillageSession(
    { apiUrl: resolveVillageApiUrl(environment), secretKey: keys.secretKey, deadlineAtMs },
    { externalId: network.villageExternalId, email: member.email },
  );
  return { session, network };
}

function linkMismatchError(member: SessionMember) {
  return new RequestError(
    CONFLICT_STATUS,
    NETWORK_ERROR_CODES.linkMismatch,
    isAdminMember(member)
      ? "The Village account linked to you uses a different email. Approve it under Admin, Members, then try again."
      : "The Village account linked to you uses a different email. An admin needs to approve it first.",
  );
}

function notLinkedError() {
  return new RequestError(
    CONFLICT_STATUS,
    NETWORK_ERROR_CODES.notLinked,
    "Your Village account isn't linked yet. Sync your network first.",
  );
}

async function confirmVillageLink(
  { database, member }: RequestContext,
  network: MemberNetworkRow,
  villageEmail: string,
) {
  const memberEmail = normalizeEmail(member.email);
  const normalizedVillageEmail = normalizeEmail(villageEmail);
  const [account] = await database
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, member.id));
  const isTrusted =
    (memberEmail === normalizedVillageEmail && account?.emailVerified === true) ||
    (network.approvedMemberEmail === memberEmail &&
      network.approvedVillageEmail === normalizedVillageEmail);

  const pendingVillageEmail = isTrusted ? null : normalizedVillageEmail;
  if (network.pendingVillageEmail !== pendingVillageEmail) {
    await database
      .update(memberNetwork)
      .set({ pendingVillageEmail })
      .where(eq(memberNetwork.userId, member.id));
  }
  return isTrusted;
}

async function requireTrustedVillageUser(
  context: RequestContext,
  network: MemberNetworkRow,
  session: VillageSession,
) {
  const villageUser = await readVillageUser(session);
  if (!villageUser) throw notLinkedError();
  if (!(await confirmVillageLink(context, network, villageUser.email))) throw linkMismatchError(context.member);
  return villageUser;
}

async function requireVillageKeys(database: Database) {
  const keys = await readVillageKeys(database);
  if (keys) return keys;
  throw new RequestError(
    SERVICE_UNAVAILABLE_STATUS,
    NETWORK_ERROR_CODES.notConfigured,
    "An admin needs to connect Village first.",
  );
}

export async function recordSharingConsent({ database, member }: RequestContext) {
  if (!(await isMemberEmailTrusted(database, member))) throw emailNotConfirmedError();

  await ensureMemberNetwork(database, member.id);
  await database
    .update(memberNetwork)
    .set({ sharingConsentedAt: new Date() })
    .where(eq(memberNetwork.userId, member.id));
}

function describeStage(context: RequestContext, stage: NetworkStage): NetworkStatus {
  return { stage, isAdmin: isAdminMember(context.member), sync: null };
}

async function markVillageLinked(database: Database, memberId: string) {
  await database.update(memberNetwork).set({ villageLinkedAt: new Date() }).where(eq(memberNetwork.userId, memberId));
}

export async function advanceNetwork(context: RequestContext): Promise<NetworkStatus> {
  const { database, environment, member } = context;

  const keys = await readVillageKeys(database);
  if (!keys) return describeStage(context, NETWORK_STAGES.notConfigured);
  if (!(await isMemberEmailTrusted(database, member))) {
    return describeStage(context, NETWORK_STAGES.needsEmailConfirmation);
  }

  const memberRow = await ensureMemberNetwork(database, member.id);
  if (!memberRow.linkedinSlug) return describeStage(context, NETWORK_STAGES.needsLinkedin);

  const group = await readVillageGroup(database);
  if (!group && !isAdminMember(member)) return describeStage(context, NETWORK_STAGES.awaitingGroup);
  if (group && !memberRow.sharingConsentedAt) {
    return describeStage(context, NETWORK_STAGES.needsConsent);
  }

  const { session, network } = await connectMember(context, keys);
  const villageUser = await readVillageUser(session);
  if (villageUser && !network.villageLinkedAt) await markVillageLinked(database, member.id);
  const sync = {
    publicKey: keys.publicKey,
    externalId: network.villageExternalId,
    sdkUrl: resolveVillageSdkUrl(environment),
  };
  if (!villageUser) return { ...describeStage(context, NETWORK_STAGES.needsSync), sync };
  if (!(await confirmVillageLink(context, network, villageUser.email))) {
    return describeStage(context, NETWORK_STAGES.linkMismatch);
  }
  if (!villageUser.isSyncComplete) return { ...describeStage(context, NETWORK_STAGES.syncing), sync };

  if (!group) return describeStage(context, NETWORK_STAGES.needsGroupCreation);
  if (network.groupJoinedAt) return describeStage(context, NETWORK_STAGES.ready);

  await joinVillageGroup(session, group.inviteLink);
  await database
    .update(memberNetwork)
    .set({ groupJoinedAt: new Date() })
    .where(eq(memberNetwork.userId, member.id));
  return describeStage(context, NETWORK_STAGES.ready);
}

async function readAppPublicKeyOrExplain(session: VillageSession) {
  try {
    return await readVillageAppPublicKey(session);
  } catch (error) {
    if (!isVillageErrorStatus(error, VILLAGE_UNAUTHORIZED_STATUS)) throw error;
    throw new RequestError(
      UNPROCESSABLE_STATUS,
      NETWORK_ERROR_CODES.keysRejected,
      "Village rejected this secret key. Copy it again from API Keys in Village, and check that your Village app is active.",
    );
  }
}

export async function verifyAndSaveVillageKeys(context: RequestContext, keys: VillageKeys) {
  const { session } = await connectMember(context, keys);

  if ((await readAppPublicKeyOrExplain(session)) !== keys.publicKey) {
    throw new RequestError(
      UNPROCESSABLE_STATUS,
      NETWORK_ERROR_CODES.keysMismatched,
      "This public key doesn't belong to the same Village app as the secret key.",
    );
  }

  await withAdminTransaction(context.database, context.member.id, async (transaction) => {
    await saveVillageKeys(transaction, keys);
    await recordAdminAction(transaction, context.member.id, { action: AUDIT_ACTIONS.villageKeysSaved });
  });
}

export async function createCommunityGroup(context: RequestContext, name: string) {
  const { database, member } = context;

  if (await readVillageGroup(database)) {
    throw new RequestError(
      CONFLICT_STATUS,
      NETWORK_ERROR_CODES.groupExists,
      "This community already has a group.",
    );
  }

  const keys = await requireVillageKeys(database);
  const { session, network } = await connectMember(context, keys);
  const villageUser = await readVillageUser(session);
  if (villageUser && !(await confirmVillageLink(context, network, villageUser.email))) {
    throw linkMismatchError(member);
  }
  if (!villageUser?.isSyncComplete) {
    throw new RequestError(
      CONFLICT_STATUS,
      NETWORK_ERROR_CODES.notReady,
      "Link and sync your Village account on the network page first.",
    );
  }

  const group = await createVillageGroup(session, name);
  await withAdminTransaction(database, member.id, async (transaction) => {
    await saveVillageGroup(transaction, group);
    const now = new Date();
    await transaction
      .update(memberNetwork)
      .set({ sharingConsentedAt: now, groupJoinedAt: now })
      .where(eq(memberNetwork.userId, member.id));
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.villageGroupCreated, detail: name });
  });
}

export async function readVillageGroupReadiness(context: RequestContext) {
  const keys = await readVillageKeys(context.database);
  if (!keys) return null;
  const { session } = await connectMember(context, keys);
  return readVillageUser(session);
}

async function readMemberSlugs(database: Database, ownSlug: string | null) {
  const members = await database
    .select({ linkedinSlug: memberNetwork.linkedinSlug })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(and(isNotNull(memberNetwork.groupJoinedAt), isActiveMember()));
  const slugs = members.flatMap(({ linkedinSlug }) => (linkedinSlug ? [linkedinSlug] : []));
  return new Set(slugs.filter((slug) => slug !== ownSlug));
}

async function requireJoinedMember({ database, member }: RequestContext) {
  const keys = await requireVillageKeys(database);
  const network = await ensureMemberNetwork(database, member.id);
  if (network.groupJoinedAt) return { keys, network };
  throw new RequestError(
    CONFLICT_STATUS,
    NETWORK_ERROR_CODES.notReady,
    "Finish joining the community on this page first.",
  );
}

function toSearchCutOffError(error: unknown) {
  if (!(error instanceof VillageApiError)) return error;
  if (error.status < INTERNAL_ERROR_STATUS || !SEARCH_CUT_OFF_TYPES.has(error.type)) return error;
  return new RequestError(
    GATEWAY_TIMEOUT_STATUS,
    NETWORK_ERROR_CODES.searchCutOff,
    "This search took too long and was cut off. It may have used one lookup. Try fewer, more specific words.",
  );
}

export async function searchMemberNetwork(
  context: RequestContext,
  prompt: string,
): Promise<NetworkSearchResult> {
  const { database, member } = context;
  const { keys, network } = await requireJoinedMember(context);
  const { session } = await connectMember(context, keys);
  await requireTrustedVillageUser(context, network, session);

  const { people, source } = await withCreditCall(database, member.id, CREDIT_CALL_KINDS.search, () =>
    searchVillageNetwork(session, prompt),
  ).catch((error: unknown) => {
    throw toSearchCutOffError(error);
  });
  if (source !== NETWORK_SOURCE) {
    console.log(
      JSON.stringify({ level: "info", scope: "village", event: "off_network_results_discarded" }),
    );
    return {
      people: [],
      discardedOffNetworkResults: true,
      dailyLookupsLeft: await readDailyLookupsLeft(database, member.id),
    };
  }

  const peopleSlugs = people.flatMap(({ linkedin_url }) => {
    const slug = readLinkedinSlug(linkedin_url);
    return slug ? [slug] : [];
  });
  const reachableMembers = await readReachableMembers(database, peopleSlugs, member.id);
  const describedPeople = people.map((person) => {
    const linkedinSlug = readLinkedinSlug(person.linkedin_url);
    const fullName = person.full_name || [person.first_name, person.last_name].filter(Boolean).join(" ");
    const member = readTrustedMember(fullName, linkedinSlug, reachableMembers);
    return {
      fullName,
      headline: person.headline ?? null,
      linkedinSlug,
      isMember: member !== null,
      memberId: member?.id ?? null,
    };
  });

  return {
    people: describedPeople.toSorted(
      (first, second) => Number(second.isMember) - Number(first.isMember),
    ),
    discardedOffNetworkResults: false,
    dailyLookupsLeft: await readDailyLookupsLeft(database, member.id),
  };
}

async function readCachedPaths(database: Database, userId: string, linkedinSlug: string) {
  const [cached] = await database
    .select()
    .from(memberPathResult)
    .where(
      and(eq(memberPathResult.userId, userId), eq(memberPathResult.linkedinSlug, linkedinSlug)),
    );
  if (!cached) return undefined;
  if (Date.now() - cached.fetchedAt.getTime() > PATH_CACHE_TTL_MS) return undefined;
  if (cached.paths === null) return null;
  const paths = villagePathsSchema.parse(cached.paths);
  return paths.person ? paths : undefined;
}

async function fetchVillagePathsOrNull(
  context: RequestContext,
  session: VillageSession,
  linkedinSlug: string,
) {
  try {
    return await withCreditCall(context.database, context.member.id, CREDIT_CALL_KINDS.path, () =>
      readVillagePaths(session, toLinkedinUrl(linkedinSlug)),
    );
  } catch (error) {
    if (isVillageErrorStatus(error, VILLAGE_NOT_FOUND_STATUS)) return null;
    throw error;
  }
}

async function readPathsFacts(
  { database, member }: RequestContext,
  villagePaths: VillagePaths | null,
  network: MemberNetworkRow,
  targetSlug: string,
  isCached: boolean,
): Promise<MemberPathsFacts> {
  const [memberSlugs, reachableMembers, dailyLookupsLeft] = await Promise.all([
    readMemberSlugs(database, network.linkedinSlug),
    readReachableMembers(database, [targetSlug, ...readPathSlugs(villagePaths)], member.id),
    readDailyLookupsLeft(database, member.id),
  ]);
  return { targetSlug, viewerSlug: network.linkedinSlug, memberSlugs, reachableMembers, isCached, dailyLookupsLeft };
}

export type OpenAsksReader = (
  database: Database,
  requesterId: string,
  targetSlug: string,
) => Promise<ReadonlyMap<string, { id: string; state: string }>>;

const NO_OPEN_ASKS: OpenAsksReader = async () => new Map();

async function describePathsForViewer(
  context: RequestContext,
  villagePaths: VillagePaths | null,
  network: MemberNetworkRow,
  targetSlug: string,
  isCached: boolean,
  readOpenAsks: OpenAsksReader,
) {
  const facts = await readPathsFacts(context, villagePaths, network, targetSlug, isCached);
  const openAsks = await readOpenAsks(context.database, context.member.id, targetSlug);
  const connectors = readConnectors(villagePaths, facts).map((connector) => ({
    ...connector,
    openAsk: connector.member ? (openAsks.get(connector.member.id) ?? null) : null,
  }));
  return describeMemberPaths(villagePaths, facts, connectors);
}

export async function readMemberPaths(context: RequestContext, linkedinSlug: string, readOpenAsks: OpenAsksReader = NO_OPEN_ASKS) {
  const { database, member } = context;
  const { keys, network } = await requireJoinedMember(context);
  const { session } = await connectMember(context, keys);
  await requireTrustedVillageUser(context, network, session);

  const cachedPaths = await readCachedPaths(database, member.id, linkedinSlug);
  if (cachedPaths !== undefined) {
    return describePathsForViewer(context, cachedPaths, network, linkedinSlug, true, readOpenAsks);
  }

  const villagePaths = await fetchVillagePathsOrNull(context, session, linkedinSlug);
  if (villagePaths === null) await requireTrustedVillageUser(context, network, session);

  const fetchedAt = new Date();
  const paths = villagePaths && { ...villagePaths, person: villagePaths.person ?? {} };
  await database
    .insert(memberPathResult)
    .values({ userId: member.id, linkedinSlug, paths, fetchedAt })
    .onConflictDoUpdate({
      target: [memberPathResult.userId, memberPathResult.linkedinSlug],
      set: { paths, fetchedAt },
    });

  return describePathsForViewer(context, villagePaths, network, linkedinSlug, false, readOpenAsks);
}

export type AskableConnectors = {
  targetName: string | null;
  targetHeadline: string | null;
  connectors: ConnectorDraft[];
};

export async function readAskableConnectors(context: RequestContext, targetSlug: string): Promise<AskableConnectors | null> {
  const { database, member } = context;
  const { network } = await requireJoinedMember(context);
  if (!(await isMemberEmailTrusted(database, member))) throw emailNotConfirmedError();
  if (network.pendingVillageEmail) throw linkMismatchError(member);
  if (targetSlug === network.linkedinSlug) {
    throw new RequestError(UNPROCESSABLE_STATUS, CONNECTOR_ERROR_CODES.ownTarget, "That's you. No intro needed.");
  }

  const cachedPaths = await readCachedPaths(database, member.id, targetSlug);
  if (!cachedPaths) return null;

  const facts = await readPathsFacts(context, cachedPaths, network, targetSlug, true);
  return {
    targetName: readTargetName(cachedPaths),
    targetHeadline: cleanVillageText(cachedPaths.person?.headline ?? "", CONNECTOR_LIMITS.headlineLength) || null,
    connectors: readConnectors(cachedPaths, facts),
  };
}

export async function readVillageLinks(database: Database) {
  return database
    .select({
      memberId: memberNetwork.userId,
      memberName: user.name,
      memberEmail: user.email,
      villageEmail: memberNetwork.pendingVillageEmail,
      approvedVillageEmail: memberNetwork.approvedVillageEmail,
      groupJoinedAt: memberNetwork.groupJoinedAt,
    })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(
      or(
        isNotNull(memberNetwork.pendingVillageEmail),
        isNotNull(memberNetwork.approvedVillageEmail),
        isNotNull(memberNetwork.sharingConsentedAt),
        isNotNull(memberNetwork.groupJoinedAt),
      ),
    );
}

export async function approveVillageLink(
  { database, member }: RequestContext,
  memberId: string,
  villageEmail: string,
) {
  const [pendingLink] = await database
    .select({ memberName: user.name, memberEmail: user.email, pendingVillageEmail: memberNetwork.pendingVillageEmail })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(eq(memberNetwork.userId, memberId));

  const normalizedVillageEmail = normalizeEmail(villageEmail);
  if (!pendingLink || pendingLink.pendingVillageEmail !== normalizedVillageEmail) {
    throw new RequestError(
      CONFLICT_STATUS,
      NETWORK_ERROR_CODES.linkChanged,
      "This Village link changed. Reload the page and check it again.",
    );
  }

  await withAdminTransaction(database, member.id, async (transaction) => {
    await transaction
      .update(memberNetwork)
      .set({
        approvedMemberEmail: normalizeEmail(pendingLink.memberEmail),
        approvedVillageEmail: normalizedVillageEmail,
        pendingVillageEmail: null,
      })
      .where(eq(memberNetwork.userId, memberId));
    await recordAdminAction(transaction, member.id, {
      action: AUDIT_ACTIONS.villageLinkApproved,
      targetMemberId: memberId,
      targetName: pendingLink.memberName,
      detail: normalizedVillageEmail,
    });
  });
}

export async function clearMemberFromGroup(database: Database, userId: string) {
  await database
    .update(memberNetwork)
    .set({ sharingConsentedAt: null, groupJoinedAt: null, villageLinkedAt: null })
    .where(eq(memberNetwork.userId, userId));
  await database.delete(memberPathResult).where(eq(memberPathResult.userId, userId));

  const [remainingMember] = await database
    .select({ userId: memberNetwork.userId })
    .from(memberNetwork)
    .where(isNotNull(memberNetwork.groupJoinedAt))
    .limit(1);
  if (!remainingMember) await deleteVillageGroup(database);
}

function leaveNotConfirmedError() {
  return new RequestError(
    CONFLICT_STATUS,
    NETWORK_ERROR_CODES.leaveNotConfirmed,
    "We couldn't confirm you left, so you're still a member. Village no longer links your account to this site. Sync your network on this page again, then leave. If that doesn't work, ask an admin.",
  );
}

export async function leaveCommunityGroup(context: RequestContext) {
  const { database, member } = context;
  const keys = await requireVillageKeys(database);
  const group = await readVillageGroup(database);
  const memberRow = await ensureMemberNetwork(database, member.id);
  if (!group || !memberRow.groupJoinedAt) {
    throw new RequestError(
      CONFLICT_STATUS,
      NETWORK_ERROR_CODES.notReady,
      "You aren't in the group.",
    );
  }

  const { session, network } = await connectMember(context, keys);
  const villageUser = await readVillageUser(session);
  if (!villageUser) throw leaveNotConfirmedError();
  if (!(await confirmVillageLink(context, network, villageUser.email))) throw linkMismatchError(context.member);

  const outcome = await leaveVillageGroup(session, group.id);
  if (outcome === VILLAGE_LEAVE_OUTCOMES.adminBlocked) {
    throw new RequestError(
      CONFLICT_STATUS,
      NETWORK_ERROR_CODES.groupAdminCannotLeave,
      "You created this group, so Village won't let you leave while other members are in it. Village requires every other member to leave first.",
    );
  }
  if (outcome === VILLAGE_LEAVE_OUTCOMES.notMember && !(await readVillageUser(session))) {
    throw leaveNotConfirmedError();
  }
  await clearMemberFromGroup(database, member.id);
}

export function staleGroupAfterLinkClears() {
  return sql`case when ${memberNetwork.groupJoinedAt} is not null then ${memberNetwork.villageExternalId} else ${memberNetwork.staleGroupExternalId} end`;
}

export async function resetVillageLink({ database, member }: RequestContext, memberId: string) {
  await withAdminTransaction(database, member.id, async (transaction) => {
    const resetMembers = await transaction
      .update(memberNetwork)
      .set({
        staleGroupExternalId: staleGroupAfterLinkClears(),
        villageExternalId: randomUUID(),
        sharingConsentedAt: null,
        groupJoinedAt: null,
        villageLinkedAt: null,
        pendingVillageEmail: null,
        approvedMemberEmail: null,
        approvedVillageEmail: null,
      })
      .where(eq(memberNetwork.userId, memberId))
      .returning({ userId: memberNetwork.userId });
    if (resetMembers.length === 0) {
      throw new RequestError(
        NOT_FOUND_STATUS,
        NETWORK_ERROR_CODES.memberNotFound,
        "This member has no Village link to reset. Reload the page.",
      );
    }

    await transaction.delete(memberPathResult).where(eq(memberPathResult.userId, memberId));
    const [target] = await transaction.select({ name: user.name }).from(user).where(eq(user.id, memberId));
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.villageLinkReset, targetMemberId: memberId, targetName: target?.name ?? null });
  });
}
