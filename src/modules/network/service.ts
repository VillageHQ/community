import "server-only";

import { randomUUID } from "node:crypto";

import { isNetworkReady, isVillageError, linkedinUrl, personName } from "@villagehq/sdk";
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
  GLOBAL_SOURCE,
  joinVillageGroup,
  leaveVillageGroup,
  mintVillageToken,
  NETWORK_SOURCE,
  readVillageAppPublicKey,
  readVillagePaths,
  readVillageUser,
  searchVillageNetwork,
  VillageGatewayError,
  type VillageConnection,
  type VillagePaths,
  type VillageSession,
  villagePathsSchema,
} from "../../platform/village/client.ts";
import { cleanVillageText } from "./rules-connector-reason.ts";
import { CREDIT_CALL_KINDS, readDailyLookupsLeft, withCreditCall } from "../../platform/village/credit-ledger.ts";
import { readLinkedinSlug } from "../members/contract-linkedin.ts";
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
import { deleteVillageGroup, readVillageGroup, readVillageSearchSettings, saveVillageGroup } from "./service-settings.ts";
import { INTRODUCER_RULES, SEARCH_SCOPES } from "./contract-village-settings.ts";
import { readVillageKeys, saveVillageKeys, type VillageKeys } from "../../platform/village/settings.ts";
import { readReachableMembers } from "./reads-reachable-members.ts";
import { resolveVillageApiUrl, resolveVillageAppUrl } from "../../platform/village/urls.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import type { SessionMember, RequestContext } from "../../platform/http/request-context.ts";
import { isAdminMember } from "../../platform/auth/roles.ts";
import { ensureMemberNetwork, normalizeEmail, isMemberEmailTrusted } from "../members/service-linkedin.ts";

const PATH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const BAD_REQUEST_STATUS = 400;
const INTERNAL_ERROR_STATUS = 500;
const SERVICE_UNAVAILABLE_STATUS = 503;
const GATEWAY_TIMEOUT_STATUS = 504;
const SYNC_STAGES: ReadonlySet<NetworkStage> = new Set([NETWORK_STAGES.needsSync, NETWORK_STAGES.syncing]);

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
  const villageConnection: VillageConnection = { apiUrl: resolveVillageApiUrl(environment), secretKey: keys.secretKey, deadlineAtMs };
  const identity = { externalId: network.villageExternalId, email: member.email };
  return { session: createVillageSession(villageConnection, identity), villageConnection, identity, network };
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
  const { email } = await readVillageUser(session);
  if (email === null) throw notLinkedError();
  if (!(await confirmVillageLink(context, network, email))) throw linkMismatchError(context.member);
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

type ConnectedMember = Awaited<ReturnType<typeof connectMember>>;
type NetworkProgress = { status: NetworkStatus; connected: ConnectedMember | null };

async function readNetworkProgress(context: RequestContext): Promise<NetworkProgress> {
  const { database, environment, member } = context;
  const atStage = (stage: NetworkStage) => ({ status: describeStage(context, stage), connected: null });

  const keys = await readVillageKeys(database);
  if (!keys) return atStage(NETWORK_STAGES.notConfigured);
  if (!(await isMemberEmailTrusted(database, member))) return atStage(NETWORK_STAGES.needsEmailConfirmation);

  const memberRow = await ensureMemberNetwork(database, member.id);
  if (!memberRow.linkedinSlug) return atStage(NETWORK_STAGES.needsLinkedin);

  const group = await readVillageGroup(database);
  if (!group && !isAdminMember(member)) return atStage(NETWORK_STAGES.awaitingGroup);
  if (group && !memberRow.sharingConsentedAt) return atStage(NETWORK_STAGES.needsConsent);

  const connected = await connectMember(context, keys);
  const { session, network } = connected;
  const villageUser = await readVillageUser(session);
  const atSyncStage = (stage: NetworkStage) => ({
    status: { ...describeStage(context, stage), sync: { appUrl: resolveVillageAppUrl(environment) } },
    connected,
  });
  if (villageUser.email === null) return atSyncStage(NETWORK_STAGES.needsSync);
  if (!network.villageLinkedAt) await markVillageLinked(database, member.id);
  if (!(await confirmVillageLink(context, network, villageUser.email))) return atStage(NETWORK_STAGES.linkMismatch);
  if (villageUser.status === "not_connected") return atSyncStage(NETWORK_STAGES.needsSync);
  if (!isNetworkReady(villageUser)) return atSyncStage(NETWORK_STAGES.syncing);

  if (!group) return atStage(NETWORK_STAGES.needsGroupCreation);
  if (network.groupJoinedAt) return atStage(NETWORK_STAGES.ready);

  await joinVillageGroup(session, group.inviteLink);
  await database
    .update(memberNetwork)
    .set({ groupJoinedAt: new Date() })
    .where(eq(memberNetwork.userId, member.id));
  return atStage(NETWORK_STAGES.ready);
}

export async function advanceNetwork(context: RequestContext): Promise<NetworkStatus> {
  return (await readNetworkProgress(context)).status;
}

export async function mintSyncToken(context: RequestContext) {
  const { status, connected } = await readNetworkProgress(context);
  if (!connected || !SYNC_STAGES.has(status.stage)) {
    throw new RequestError(
      CONFLICT_STATUS,
      NETWORK_ERROR_CODES.notReady,
      "Your network doesn't need a sync right now. Reload this page to see the next step.",
    );
  }
  return { token: await mintVillageToken(connected.villageConnection, connected.identity) };
}

async function readAppPublicKeyOrExplain(session: VillageSession) {
  try {
    return await readVillageAppPublicKey(session);
  } catch (error) {
    if (!isVillageError(error, "unauthorized")) throw error;
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
  if (villageUser.email !== null && !(await confirmVillageLink(context, network, villageUser.email))) {
    throw linkMismatchError(member);
  }
  if (villageUser.email === null || !isNetworkReady(villageUser)) {
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
  const villageUser = await readVillageUser(session);
  return { isSynced: villageUser.email !== null && isNetworkReady(villageUser) };
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

function isUnreadableAnswer(error: unknown) {
  if (!(error instanceof VillageGatewayError)) return false;
  return error.answeredStatus < BAD_REQUEST_STATUS || error.answeredStatus >= INTERNAL_ERROR_STATUS;
}

function isSearchCutOff(error: unknown) {
  return isVillageError(error, "timeout") || isVillageError(error, "invalid_response") || isUnreadableAnswer(error);
}

function toSearchCutOffError(error: unknown) {
  if (!isSearchCutOff(error)) return error;
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

  const spender = { database, environment: context.environment, memberId: member.id };
  // "Everyone" shows people beyond the members' networks too. They name no path: paths come only from the paths
  // lookup, which keeps to members who share.
  const { searchScope } = await readVillageSearchSettings(database);
  const scope = searchScope === SEARCH_SCOPES.everyone ? GLOBAL_SOURCE : NETWORK_SOURCE;
  const { people, source } = await withCreditCall(spender, CREDIT_CALL_KINDS.search, () =>
    searchVillageNetwork(session, prompt, scope),
  ).catch((error: unknown) => {
    throw toSearchCutOffError(error);
  });
  if (source !== NETWORK_SOURCE && scope === NETWORK_SOURCE) {
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
    const fullName = personName(person);
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

function isPersonKnown(villagePaths: VillagePaths | null) {
  return villagePaths !== null;
}

function fetchVillagePathsOrNull(
  context: RequestContext,
  session: VillageSession,
  linkedinSlug: string,
) {
  return withCreditCall(
    { database: context.database, environment: context.environment, memberId: context.member.id },
    CREDIT_CALL_KINDS.path,
    () => readVillagePaths(session, linkedinUrl(linkedinSlug)),
    isPersonKnown,
  );
}

// With "chosen members" on, a path through any other member is dropped, so that member is never offered or asked as a
// connector. Paths through people who aren't members (the viewer's own contacts) stay.
async function keepChosenIntroducers(database: Database, villagePaths: VillagePaths | null): Promise<VillagePaths | null> {
  if (!villagePaths) return villagePaths;
  const { introducers, chosenIntroducerIds } = await readVillageSearchSettings(database);
  if (introducers !== INTRODUCER_RULES.chosen) return villagePaths;
  const members = await database
    .select({ id: memberNetwork.userId, linkedinSlug: memberNetwork.linkedinSlug })
    .from(memberNetwork)
    .where(isNotNull(memberNetwork.linkedinSlug));
  const chosen = new Set(chosenIntroducerIds);
  const unchosenSlugs = new Set(members.flatMap(({ id, linkedinSlug }) => (linkedinSlug && !chosen.has(id) ? [linkedinSlug] : [])));
  const paths = villagePaths.paths.filter(({ introducer }) => {
    const slug = introducer ? readLinkedinSlug(introducer.profile.linkedin_url) : null;
    return !slug || !unchosenSlugs.has(slug);
  });
  return { ...villagePaths, paths };
}

// False only when the admin limited intros to chosen members and this member isn't one of them.
export async function canMemberIntroduce(database: Database, memberId: string) {
  const { introducers, chosenIntroducerIds } = await readVillageSearchSettings(database);
  return introducers !== INTRODUCER_RULES.chosen || chosenIntroducerIds.includes(memberId);
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

export const NO_OPEN_ASKS: OpenAsksReader = async () => new Map();

async function describePathsForViewer(
  context: RequestContext,
  villagePaths: VillagePaths | null,
  network: MemberNetworkRow,
  targetSlug: string,
  isCached: boolean,
  readOpenAsks: OpenAsksReader,
) {
  villagePaths = await keepChosenIntroducers(context.database, villagePaths);
  const facts = await readPathsFacts(context, villagePaths, network, targetSlug, isCached);
  const openAsks = await readOpenAsks(context.database, context.member.id, targetSlug);
  const connectors = readConnectors(villagePaths, facts).map((connector) => ({
    ...connector,
    openAsk: connector.member ? (openAsks.get(connector.member.id) ?? null) : null,
  }));
  return describeMemberPaths(villagePaths, facts, connectors);
}

export async function readMemberPaths(context: RequestContext, linkedinSlug: string, readOpenAsks: OpenAsksReader) {
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

  const cachedPaths = await keepChosenIntroducers(database, (await readCachedPaths(database, member.id, targetSlug)) ?? null);
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
  const { email } = await readVillageUser(session);
  if (email === null) throw leaveNotConfirmedError();
  if (!(await confirmVillageLink(context, network, email))) throw linkMismatchError(context.member);

  const outcome = await leaveVillageGroup(session, group.id);
  if (outcome === "admin_blocked") {
    throw new RequestError(
      CONFLICT_STATUS,
      NETWORK_ERROR_CODES.groupAdminCannotLeave,
      "You created this group, so Village won't let you leave while other members are in it. Village requires every other member to leave first.",
    );
  }
  if (outcome === "not_member" && (await readVillageUser(session)).email === null) {
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
