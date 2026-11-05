import "server-only";

import { and, asc, count, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";

import { memberRemoval } from "../../database/admin-schema.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { invite, memberAvatar, memberNetwork } from "../../modules/members/schema.ts";
import { isReclaimedEmail } from "../../platform/auth/reclaimed-email.ts";
import { isActiveMember, isBanActive, isBanInEffect } from "../../platform/auth/member-status.ts";
import { toContainsPattern } from "../../modules/members/reads-directory.ts";
import { toAvatarUrl } from "../../modules/members/service-profile.ts";
import { toLinkedinUrl } from "../../modules/members/contract-linkedin.ts";
import { readVillageStatus } from "../village/member-village-status.ts";
import {
  ADMIN_PAGE_SIZES,
  CONTENT_CHOICES,
  MEMBER_FILTERS,
  memberPageSchema,
  type MemberFilter,
  type MemberListBody,
  type MemberPage,
} from "./admin-api.ts";
import { MEMBER_ROLES } from "../../platform/auth/roles.ts";

function matchesMemberSearch(search: string) {
  if (!search) return undefined;
  const pattern = toContainsPattern(search);
  return or(ilike(user.name, pattern), ilike(user.email, pattern), ilike(memberNetwork.linkedinSlug, pattern));
}

const needsAttention = () => and(isActiveMember(), or(eq(user.emailVerified, false), isNotNull(memberNetwork.pendingVillageEmail)));

const MEMBER_FILTER_CONDITIONS: Record<MemberFilter, () => ReturnType<typeof and>> = {
  [MEMBER_FILTERS.all]: () => undefined,
  [MEMBER_FILTERS.admins]: () => and(eq(user.role, MEMBER_ROLES.admin), isActiveMember()),
  [MEMBER_FILTERS.attention]: needsAttention,
  [MEMBER_FILTERS.removed]: () => isBanInEffect(),
};

function countMembers(database: Database, conditions: ReturnType<typeof and>) {
  return database
    .select({ memberCount: count() })
    .from(user)
    .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
    .where(conditions);
}

async function readFilterCounts(database: Database, search: string) {
  const filters = Object.values(MEMBER_FILTERS);
  const results = await Promise.all(
    filters.map((filter) => countMembers(database, and(MEMBER_FILTER_CONDITIONS[filter](), matchesMemberSearch(search)))),
  );
  return Object.fromEntries(filters.map((filter, position) => [filter, results[position]?.[0]?.memberCount ?? 0]));
}

function selectMembers(database: Database) {
  return database
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified,
      banned: user.banned,
      banExpires: user.banExpires,
      avatarUpdatedAt: memberAvatar.updatedAt,
      inviteId: invite.id,
      removedAt: memberRemoval.removedAt,
      keepsContent: memberRemoval.keepsContent,
      networkUserId: memberNetwork.userId,
      pendingVillageEmail: memberNetwork.pendingVillageEmail,
      groupJoinedAt: memberNetwork.groupJoinedAt,
      villageLinkedAt: memberNetwork.villageLinkedAt,
      staleGroupExternalId: memberNetwork.staleGroupExternalId,
      villageLeaveOutcome: memberRemoval.villageLeaveOutcome,
      sharingConsentedAt: memberNetwork.sharingConsentedAt,
      linkedinSlug: memberNetwork.linkedinSlug,
      linkedinConfirmedSlug: memberNetwork.linkedinConfirmedSlug,
    })
    .from(user)
    .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
    .leftJoin(memberRemoval, eq(memberRemoval.userId, user.id))
    .leftJoin(invite, and(eq(invite.acceptedUserId, user.id), isNull(invite.revokedAt)));
}

type MemberRow = Awaited<ReturnType<typeof selectMembers>>[number];

function readRemovalChoice({ keepsContent }: MemberRow) {
  if (keepsContent === null) return null;
  return keepsContent ? CONTENT_CHOICES.keep : CONTENT_CHOICES.delete;
}

function toAdminMember(row: MemberRow) {
  const isReclaimed = isReclaimedEmail(row.email);
  return {
    id: row.id,
    name: row.name,
    email: isReclaimed ? null : row.email,
    avatarUrl: toAvatarUrl(row.id, row.avatarUpdatedAt),
    isAdmin: row.role === MEMBER_ROLES.admin,
    joinedAt: row.createdAt.toISOString(),
    isEmailConfirmed: row.emailVerified,
    isRemoved: isBanActive(row),
    isReclaimed,
    removedAt: row.removedAt?.toISOString() ?? null,
    removalContentChoice: readRemovalChoice(row),
    inviteId: row.inviteId,
    villageStatus: readVillageStatus({
      pendingVillageEmail: row.pendingVillageEmail,
      groupJoinedAt: row.groupJoinedAt,
      villageLinkedAt: row.villageLinkedAt,
      sharingConsentedAt: row.sharingConsentedAt,
    }),
    hasVillageLink: row.networkUserId !== null,
    pendingVillageEmail: row.pendingVillageEmail,
    isInVillageGroup: row.groupJoinedAt !== null,
    hasStaleVillageMembership: row.staleGroupExternalId !== null,
    villageLeaveOutcome: row.villageLeaveOutcome,
    linkedinUrl: row.linkedinSlug ? toLinkedinUrl(row.linkedinSlug) : null,
    isLinkedinConfirmed: Boolean(row.linkedinSlug) && row.linkedinSlug === row.linkedinConfirmedSlug,
  };
}

export async function readAdminMembers(database: Database, { search, filter, page: requestedPage }: MemberListBody): Promise<MemberPage> {
  const conditions = and(MEMBER_FILTER_CONDITIONS[filter](), matchesMemberSearch(search));
  const counts = await readFilterCounts(database, search);
  const matchCount = counts[filter] ?? 0;
  const pageCount = Math.max(1, Math.ceil(matchCount / ADMIN_PAGE_SIZES.members));
  const page = Math.min(requestedPage, pageCount);
  const rows = await selectMembers(database)
    .where(conditions)
    .orderBy(asc(isBanInEffect()), asc(user.name), asc(user.id))
    .limit(ADMIN_PAGE_SIZES.members)
    .offset((page - 1) * ADMIN_PAGE_SIZES.members);
  return memberPageSchema.parse({ members: rows.map(toAdminMember), page, pageCount, matchCount, counts });
}
