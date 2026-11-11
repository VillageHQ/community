import "server-only";

import { isVillageError } from "@villagehq/sdk";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../../platform/settings/schema.ts";
import { readSettings, saveSettings } from "../../platform/settings/store.ts";
import {
  createVillageSearchSession,
  joinVillageGroup,
  leaveVillageGroup,
  type VillagePaths,
  type VillageSession,
} from "../../platform/village/client.ts";
import type { VillageKeys } from "../../platform/village/settings.ts";
import { resolveVillageApiUrl } from "../../platform/village/urls.ts";
import { readLinkedinSlug } from "../members/contract-linkedin.ts";
import { memberNetwork } from "../members/schema.ts";
import { NETWORK_ERROR_CODES } from "./contract.ts";
import { readLookupEmail } from "./service-fill-in.ts";
import type { VillageGroup } from "./service-settings.ts";

const CONFLICT_STATUS = 409;
const SERVICE_UNAVAILABLE_STATUS = 503;
const DIRECT_DEGREE = 1;

// Members who haven't connected their own network search as the app's search identity (see createVillageSearchSession).
// It joins the community group once, the first time anyone needs it, and again only if the group changes.
export async function openPooledSearchSession(context: RequestContext, keys: VillageKeys, group: VillageGroup): Promise<VillageSession> {
  const { database, environment, deadlineAtMs } = context;
  const email = await readLookupEmail(database);
  if (!email) {
    throw new RequestError(
      SERVICE_UNAVAILABLE_STATUS,
      NETWORK_ERROR_CODES.notConfigured,
      "Community search needs a service email. An admin can add one under Village settings.",
    );
  }
  const session = createVillageSearchSession({ apiUrl: resolveVillageApiUrl(environment), secretKey: keys.secretKey, deadlineAtMs }, email);
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.villageSearchGroupId]);
  if (settings.get(INSTANCE_SETTING_KEYS.villageSearchGroupId) === group.id) return session;

  await joinVillageGroup(session, group.inviteLink).catch((error: unknown) => {
    if (!isVillageError(error, "conflict")) throw error;
  });
  await saveSettings(database, { [INSTANCE_SETTING_KEYS.villageSearchGroupId]: group.id });
  return session;
}

// Village refusing the search identity means it won't search a group for a user who never synced. The member can
// still add their own network and search as themselves.
export function toPooledSearchRefusal(error: unknown) {
  if (!isVillageError(error, "forbidden") && !isVillageError(error, "not_found")) return error;
  return new RequestError(
    CONFLICT_STATUS,
    NETWORK_ERROR_CODES.pooledSearchUnavailable,
    "Searching the community's networks isn't available right now. Add your network to search the people you know.",
  );
}

// A pooled path may only run through members who shared: the search identity knows nobody itself, so a direct path,
// or a step through anyone else, is dropped before anything reads it.
export function keepSharingMembersPaths(villagePaths: VillagePaths | null, sharingSlugs: ReadonlySet<string>): VillagePaths | null {
  if (!villagePaths) return villagePaths;
  const isSharing = (linkedinUrl: string | null | undefined) => sharingSlugs.has(readLinkedinSlug(linkedinUrl) ?? "");
  const paths = villagePaths.paths
    .filter(({ degree }) => degree !== DIRECT_DEGREE)
    .map((path) => ({ ...path, starters: path.starters.filter(({ profile }) => isSharing(profile.linkedin_url)) }))
    .filter(({ introducer, starters }) => starters.length > 0 || isSharing(introducer?.profile.linkedin_url));
  return { ...villagePaths, paths };
}

// A member who hasn't agreed to share is never named on a path, not even as the outside contact a sharing member goes
// through. Any path naming one is dropped, for every searcher. The person being reached is not a step on the path.
export function dropNonSharingMembers(villagePaths: VillagePaths | null, nonSharingSlugs: ReadonlySet<string>): VillagePaths | null {
  if (!villagePaths || nonSharingSlugs.size === 0) return villagePaths;
  const isNonSharing = (linkedinUrl: string | null | undefined) => nonSharingSlugs.has(readLinkedinSlug(linkedinUrl) ?? "");
  const paths = villagePaths.paths.filter(
    ({ introducer, starters }) =>
      !isNonSharing(introducer?.profile.linkedin_url) &&
      !starters.some(({ is_current_user, profile }) => !is_current_user && isNonSharing(profile.linkedin_url)),
  );
  return { ...villagePaths, paths };
}

// Members with a LinkedIn link who aren't sharing now: never joined, left, or no longer active.
export async function readNonSharingSlugs(database: Database, exceptSlugs: ReadonlyArray<string | null>) {
  const members = await database
    .select({ linkedinSlug: memberNetwork.linkedinSlug, groupJoinedAt: memberNetwork.groupJoinedAt, isActive: sql<boolean>`${isActiveMember()}` })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(isNotNull(memberNetwork.linkedinSlug));
  const kept = new Set(exceptSlugs);
  return new Set(
    members.flatMap(({ linkedinSlug, groupJoinedAt, isActive }) =>
      linkedinSlug && !kept.has(linkedinSlug) && (!groupJoinedAt || !isActive) ? [linkedinSlug] : [],
    ),
  );
}

async function hasOtherJoinedMember(database: Database, memberId: string) {
  const [other] = await database
    .select({ userId: memberNetwork.userId })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(and(isNotNull(memberNetwork.groupJoinedAt), ne(memberNetwork.userId, memberId), isActiveMember()))
    .limit(1);
  return other !== undefined;
}

// Village won't let the group's creator leave while anyone else is in it, and the search identity counts. When the
// creator is the last member, the search identity leaves first. Returns whether it did.
export async function leaveSearchIdentityForLastMember(context: RequestContext, keys: VillageKeys, group: VillageGroup, leavingMemberId: string) {
  const { database } = context;
  if (await hasOtherJoinedMember(database, leavingMemberId)) return false;
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.villageSearchGroupId]);
  if (settings.get(INSTANCE_SETTING_KEYS.villageSearchGroupId) !== group.id) return false;
  const email = await readLookupEmail(database);
  if (!email) return false;
  const { environment, deadlineAtMs } = context;
  const session = createVillageSearchSession({ apiUrl: resolveVillageApiUrl(environment), secretKey: keys.secretKey, deadlineAtMs }, email);
  await leaveVillageGroup(session, group.id);
  await database.delete(instanceSettings).where(eq(instanceSettings.key, INSTANCE_SETTING_KEYS.villageSearchGroupId));
  return true;
}
