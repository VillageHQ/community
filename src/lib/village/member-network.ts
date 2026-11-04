import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, isNotNull, ne, or } from "drizzle-orm";

import { user } from "../../database/auth-schema.ts";
import type { Database } from "../../database/client.ts";
import { memberNetwork, memberPathResult } from "../../database/village-schema.ts";
import type { Environment } from "../environment.ts";
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
  type VillageSession,
  villagePathsSchema,
} from "./client.ts";
import { withCreditCall } from "./daily-usage.ts";
import { readLinkedinSlug, toLinkedinUrl } from "./linkedin-slug.ts";
import { describeMemberPaths } from "./member-paths.ts";
import {
  NETWORK_ERROR_CODES,
  NETWORK_STAGES,
  type NetworkSearchResult,
  type NetworkStage,
  type NetworkStatus,
} from "./network-api.ts";
import {
  deleteVillageGroup,
  readVillageGroup,
  readVillageKeys,
  saveVillageGroup,
  saveVillageKeys,
  type VillageKeys,
} from "./settings.ts";
import { resolveVillageApiUrl, resolveVillageSdkUrl } from "./urls.ts";

const ADMIN_ROLE = "admin";
const PATH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ROUTE_DEADLINE_MS = 60_000;
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

export type SessionMember = { id: string; email: string; role?: string | null };

export type NetworkContext = {
  database: Database;
  environment: Environment;
  member: SessionMember;
  deadlineAtMs: number;
};

export function createNetworkContext(
  database: Database,
  environment: Environment,
  member: SessionMember,
  deadlineMs = DEFAULT_ROUTE_DEADLINE_MS,
): NetworkContext {
  return { database, environment, member, deadlineAtMs: Date.now() + deadlineMs };
}

export class NetworkRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isAdminMember(member: SessionMember) {
  return member.role === ADMIN_ROLE;
}

type MemberNetworkRow = typeof memberNetwork.$inferSelect;

async function ensureMemberNetwork(database: Database, userId: string) {
  await database.insert(memberNetwork).values({ userId }).onConflictDoNothing();
  const [network] = await database
    .select()
    .from(memberNetwork)
    .where(eq(memberNetwork.userId, userId));
  if (!network) throw new Error("The member network row is missing.");
  return network;
}

async function connectMember(
  { database, environment, member, deadlineAtMs }: NetworkContext,
  keys: VillageKeys,
) {
  const network = await ensureMemberNetwork(database, member.id);
  const session = createVillageSession(
    { apiUrl: resolveVillageApiUrl(environment), secretKey: keys.secretKey, deadlineAtMs },
    { externalId: network.villageExternalId, email: member.email },
  );
  return { session, network };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function linkMismatchError() {
  return new NetworkRequestError(
    CONFLICT_STATUS,
    NETWORK_ERROR_CODES.linkMismatch,
    "The Village account linked to you uses a different email. An admin needs to approve it first.",
  );
}

function notLinkedError() {
  return new NetworkRequestError(
    CONFLICT_STATUS,
    NETWORK_ERROR_CODES.notLinked,
    "Your Village account isn't linked yet. Sync your network first.",
  );
}

async function confirmVillageLink(
  { database, member }: NetworkContext,
  network: MemberNetworkRow,
  villageEmail: string,
) {
  const memberEmail = normalizeEmail(member.email);
  const normalizedVillageEmail = normalizeEmail(villageEmail);
  const isTrusted =
    memberEmail === normalizedVillageEmail ||
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
  context: NetworkContext,
  network: MemberNetworkRow,
  session: VillageSession,
) {
  const villageUser = await readVillageUser(session);
  if (!villageUser) throw notLinkedError();
  if (!(await confirmVillageLink(context, network, villageUser.email))) throw linkMismatchError();
  return villageUser;
}

async function requireVillageKeys(database: Database) {
  const keys = await readVillageKeys(database);
  if (keys) return keys;
  throw new NetworkRequestError(
    SERVICE_UNAVAILABLE_STATUS,
    NETWORK_ERROR_CODES.notConfigured,
    "An admin needs to connect Village first.",
  );
}

export async function saveMemberLinkedinUrl(
  { database, member }: NetworkContext,
  linkedinUrl: string,
) {
  const linkedinSlug = readLinkedinSlug(linkedinUrl);
  if (!linkedinSlug) {
    throw new NetworkRequestError(
      UNPROCESSABLE_STATUS,
      NETWORK_ERROR_CODES.linkedinInvalid,
      "Enter your LinkedIn profile URL, like https://www.linkedin.com/in/your-name.",
    );
  }

  await ensureMemberNetwork(database, member.id);

  const [claimedByAnotherMember] = await database
    .select({ userId: memberNetwork.userId })
    .from(memberNetwork)
    .where(and(eq(memberNetwork.linkedinSlug, linkedinSlug), ne(memberNetwork.userId, member.id)));
  if (claimedByAnotherMember) {
    throw new NetworkRequestError(
      CONFLICT_STATUS,
      NETWORK_ERROR_CODES.linkedinTaken,
      "Another member already uses this LinkedIn profile. Ask an admin for help.",
    );
  }

  await database
    .update(memberNetwork)
    .set({ linkedinSlug })
    .where(eq(memberNetwork.userId, member.id));
}

export async function recordSharingConsent({ database, member }: NetworkContext) {
  await ensureMemberNetwork(database, member.id);
  await database
    .update(memberNetwork)
    .set({ sharingConsentedAt: new Date() })
    .where(eq(memberNetwork.userId, member.id));
}

function describeStage(context: NetworkContext, stage: NetworkStage): NetworkStatus {
  return { stage, isAdmin: isAdminMember(context.member), sync: null };
}

export async function advanceNetwork(context: NetworkContext): Promise<NetworkStatus> {
  const { database, environment, member } = context;

  const keys = await readVillageKeys(database);
  if (!keys) return describeStage(context, NETWORK_STAGES.notConfigured);

  const memberRow = await ensureMemberNetwork(database, member.id);
  if (!memberRow.linkedinSlug) return describeStage(context, NETWORK_STAGES.needsLinkedin);

  const group = await readVillageGroup(database);
  if (!group && !isAdminMember(member)) return describeStage(context, NETWORK_STAGES.awaitingGroup);
  if (group && !memberRow.sharingConsentedAt) {
    return describeStage(context, NETWORK_STAGES.needsConsent);
  }

  const { session, network } = await connectMember(context, keys);
  const villageUser = await readVillageUser(session);
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
    throw new NetworkRequestError(
      UNPROCESSABLE_STATUS,
      NETWORK_ERROR_CODES.keysRejected,
      "Village rejected this secret key. Copy it again from Platform Settings, and check that the app is active.",
    );
  }
}

export async function verifyAndSaveVillageKeys(context: NetworkContext, keys: VillageKeys) {
  const { session } = await connectMember(context, keys);

  if ((await readAppPublicKeyOrExplain(session)) !== keys.publicKey) {
    throw new NetworkRequestError(
      UNPROCESSABLE_STATUS,
      NETWORK_ERROR_CODES.keysMismatched,
      "This public key doesn't belong to the same Village app as the secret key.",
    );
  }

  await saveVillageKeys(context.database, keys);
}

export async function createCommunityGroup(context: NetworkContext, name: string) {
  const { database, member } = context;

  if (await readVillageGroup(database)) {
    throw new NetworkRequestError(
      CONFLICT_STATUS,
      NETWORK_ERROR_CODES.groupExists,
      "This community already has a group.",
    );
  }

  const keys = await requireVillageKeys(database);
  const { session, network } = await connectMember(context, keys);
  const villageUser = await readVillageUser(session);
  if (villageUser && !(await confirmVillageLink(context, network, villageUser.email))) {
    throw linkMismatchError();
  }
  if (!villageUser?.isSyncComplete) {
    throw new NetworkRequestError(
      CONFLICT_STATUS,
      NETWORK_ERROR_CODES.notReady,
      "Link and sync your Village account on the network page first.",
    );
  }

  const group = await createVillageGroup(session, name);
  await saveVillageGroup(database, group);

  const now = new Date();
  await database
    .update(memberNetwork)
    .set({ sharingConsentedAt: now, groupJoinedAt: now })
    .where(eq(memberNetwork.userId, member.id));
}

export async function readVillageGroupReadiness(context: NetworkContext) {
  const keys = await readVillageKeys(context.database);
  if (!keys) return null;
  const { session } = await connectMember(context, keys);
  return readVillageUser(session);
}

async function readMemberSlugs(database: Database, ownSlug: string | null) {
  const members = await database
    .select({ linkedinSlug: memberNetwork.linkedinSlug })
    .from(memberNetwork)
    .where(isNotNull(memberNetwork.groupJoinedAt));
  const slugs = members.flatMap(({ linkedinSlug }) => (linkedinSlug ? [linkedinSlug] : []));
  return new Set(slugs.filter((slug) => slug !== ownSlug));
}

async function requireJoinedMember({ database, member }: NetworkContext) {
  const keys = await requireVillageKeys(database);
  const network = await ensureMemberNetwork(database, member.id);
  if (network.groupJoinedAt) return { keys, network };
  throw new NetworkRequestError(
    CONFLICT_STATUS,
    NETWORK_ERROR_CODES.notReady,
    "Finish joining the community on this page first.",
  );
}

function toSearchCutOffError(error: unknown) {
  if (!(error instanceof VillageApiError)) return error;
  if (error.status < INTERNAL_ERROR_STATUS || !SEARCH_CUT_OFF_TYPES.has(error.type)) return error;
  return new NetworkRequestError(
    GATEWAY_TIMEOUT_STATUS,
    NETWORK_ERROR_CODES.searchCutOff,
    "This search took too long and was cut off. It may have used one lookup. Try fewer, more specific words.",
  );
}

export async function searchMemberNetwork(
  context: NetworkContext,
  prompt: string,
): Promise<NetworkSearchResult> {
  const { database, member } = context;
  const { keys, network } = await requireJoinedMember(context);
  const { session } = await connectMember(context, keys);
  await requireTrustedVillageUser(context, network, session);

  const { people, source } = await withCreditCall(database, member.id, () =>
    searchVillageNetwork(session, prompt),
  ).catch((error: unknown) => {
    throw toSearchCutOffError(error);
  });
  if (source !== NETWORK_SOURCE) {
    console.log(
      JSON.stringify({ level: "info", scope: "village", event: "off_network_results_discarded" }),
    );
    return { people: [], discardedOffNetworkResults: true };
  }

  const memberSlugs = await readMemberSlugs(database, network.linkedinSlug);
  const describedPeople = people.map((person) => {
    const linkedinSlug = readLinkedinSlug(person.linkedin_url);
    return {
      fullName: person.full_name || [person.first_name, person.last_name].filter(Boolean).join(" "),
      headline: person.headline ?? null,
      linkedinSlug,
      isMember: linkedinSlug !== null && memberSlugs.has(linkedinSlug),
    };
  });

  return {
    people: describedPeople.toSorted(
      (first, second) => Number(second.isMember) - Number(first.isMember),
    ),
    discardedOffNetworkResults: false,
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
  return villagePathsSchema.parse(cached.paths);
}

async function fetchVillagePathsOrNull(
  context: NetworkContext,
  session: VillageSession,
  linkedinSlug: string,
) {
  try {
    return await withCreditCall(context.database, context.member.id, () =>
      readVillagePaths(session, toLinkedinUrl(linkedinSlug)),
    );
  } catch (error) {
    if (isVillageErrorStatus(error, VILLAGE_NOT_FOUND_STATUS)) return null;
    throw error;
  }
}

export async function readMemberPaths(context: NetworkContext, linkedinSlug: string) {
  const { database, member } = context;
  const { keys, network } = await requireJoinedMember(context);
  const { session } = await connectMember(context, keys);
  await requireTrustedVillageUser(context, network, session);
  const memberSlugs = await readMemberSlugs(database, network.linkedinSlug);

  const cachedPaths = await readCachedPaths(database, member.id, linkedinSlug);
  if (cachedPaths !== undefined) {
    return describeMemberPaths(cachedPaths, linkedinSlug, memberSlugs, true);
  }

  const villagePaths = await fetchVillagePathsOrNull(context, session, linkedinSlug);
  if (villagePaths === null) await requireTrustedVillageUser(context, network, session);

  const fetchedAt = new Date();
  await database
    .insert(memberPathResult)
    .values({ userId: member.id, linkedinSlug, paths: villagePaths, fetchedAt })
    .onConflictDoUpdate({
      target: [memberPathResult.userId, memberPathResult.linkedinSlug],
      set: { paths: villagePaths, fetchedAt },
    });

  return describeMemberPaths(villagePaths, linkedinSlug, memberSlugs, false);
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
  { database }: NetworkContext,
  memberId: string,
  villageEmail: string,
) {
  const [pendingLink] = await database
    .select({ memberEmail: user.email, pendingVillageEmail: memberNetwork.pendingVillageEmail })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(eq(memberNetwork.userId, memberId));

  const normalizedVillageEmail = normalizeEmail(villageEmail);
  if (!pendingLink || pendingLink.pendingVillageEmail !== normalizedVillageEmail) {
    throw new NetworkRequestError(
      CONFLICT_STATUS,
      NETWORK_ERROR_CODES.linkChanged,
      "This Village link changed. Reload the page and check it again.",
    );
  }

  await database
    .update(memberNetwork)
    .set({
      approvedMemberEmail: normalizeEmail(pendingLink.memberEmail),
      approvedVillageEmail: normalizedVillageEmail,
      pendingVillageEmail: null,
    })
    .where(eq(memberNetwork.userId, memberId));
}

async function clearMemberFromGroup(database: Database, userId: string) {
  await database
    .update(memberNetwork)
    .set({ sharingConsentedAt: null, groupJoinedAt: null })
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
  return new NetworkRequestError(
    CONFLICT_STATUS,
    NETWORK_ERROR_CODES.leaveNotConfirmed,
    "We couldn't confirm you left, so you're still a member. Village no longer links your account to this site. Sync your network on this page again, then leave. If that doesn't work, ask an admin.",
  );
}

export async function leaveCommunityGroup(context: NetworkContext) {
  const { database, member } = context;
  const keys = await requireVillageKeys(database);
  const group = await readVillageGroup(database);
  const memberRow = await ensureMemberNetwork(database, member.id);
  if (!group || !memberRow.groupJoinedAt) {
    throw new NetworkRequestError(
      CONFLICT_STATUS,
      NETWORK_ERROR_CODES.notReady,
      "You aren't in the group.",
    );
  }

  const { session, network } = await connectMember(context, keys);
  const villageUser = await readVillageUser(session);
  if (!villageUser) throw leaveNotConfirmedError();
  if (!(await confirmVillageLink(context, network, villageUser.email))) throw linkMismatchError();

  const outcome = await leaveVillageGroup(session, group.id);
  if (outcome === VILLAGE_LEAVE_OUTCOMES.adminBlocked) {
    throw new NetworkRequestError(
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

export async function resetVillageLink({ database }: NetworkContext, memberId: string) {
  const resetMembers = await database
    .update(memberNetwork)
    .set({
      villageExternalId: randomUUID(),
      sharingConsentedAt: null,
      groupJoinedAt: null,
      pendingVillageEmail: null,
      approvedMemberEmail: null,
      approvedVillageEmail: null,
    })
    .where(eq(memberNetwork.userId, memberId))
    .returning({ userId: memberNetwork.userId });
  if (resetMembers.length === 0) {
    throw new NetworkRequestError(
      NOT_FOUND_STATUS,
      NETWORK_ERROR_CODES.memberNotFound,
      "This member has no Village link to reset. Reload the page.",
    );
  }

  await database.delete(memberPathResult).where(eq(memberPathResult.userId, memberId));
}
