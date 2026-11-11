import "server-only";

import { and, asc, count, desc, eq, gt, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";

import { memberRemoval, invite, memberAvatar, memberNetwork, memberProfile } from "../members/schema.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { isReclaimedEmail } from "../../platform/auth/reclaimed-email.ts";
import { isActiveMember, isBanActive, isBanInEffect } from "../../platform/auth/member-status.ts";
import { toContainsPattern } from "../members/reads-directory.ts";
import { companyLogoColumn, filledFaceColumn, toShownFaceUrl } from "../members/reads-pictures.ts";
import { FILL_IN_FIELDS, shownFillInColumn } from "../members/service-fill-in.ts";
import { CONSOLE_MEMBER_STATES, type ConsoleMember } from "./console-members.ts";
import { linkedinUrl } from "@villagehq/sdk";
import { readVillageStatus } from "../network/contract-village-status.ts";
import {
  ADMIN_PAGE_SIZES,
  CONTENT_CHOICES,
  MEMBER_FILTERS,
  memberPageSchema,
  type MemberFilter,
  type MemberListBody,
  type MemberPage,
} from "./contract.ts";
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
      filledFace: filledFaceColumn(user.id),
      inviteId: invite.id,
      removedAt: memberRemoval.removedAt,
      keepsContent: memberRemoval.keepsContent,
      networkUserId: memberNetwork.userId,
      pendingVillageEmail: memberNetwork.pendingVillageEmail,
      groupJoinedAt: memberNetwork.groupJoinedAt,
      villageLinkedAt: memberNetwork.villageLinkedAt,
      staleGroupExternalId: memberNetwork.staleGroupExternalId,
      villageLeaveOutcome: memberRemoval.villageLeaveOutcome,
      erasedAt: memberRemoval.erasedAt,
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
    avatarUrl: toShownFaceUrl(row.id, row.avatarUpdatedAt, row.filledFace),
    isAdmin: row.role === MEMBER_ROLES.admin,
    joinedAt: row.createdAt.toISOString(),
    isEmailConfirmed: row.emailVerified,
    isRemoved: isBanActive(row),
    isReclaimed,
    isErased: row.erasedAt !== null,
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
    linkedinUrl: row.linkedinSlug ? linkedinUrl(row.linkedinSlug) : null,
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

const filledTitle = shownFillInColumn(FILL_IN_FIELDS.title);
const filledCompany = shownFillInColumn(FILL_IN_FIELDS.company);
const shownTitle = sql<string | null>`coalesce(nullif(${memberProfile.title}, ''), ${filledTitle.line.value})`;
const shownCompany = sql<string | null>`coalesce(nullif(${memberProfile.company}, ''), ${filledCompany.line.value})`;

// The console's Members table: every member (removed ones included, for their own filter) and every open invite
// nobody has accepted yet. Admins see email addresses here; nobody else does.
export async function readConsoleMembers(database: Database, now = new Date()): Promise<ConsoleMember[]> {
  const [members, invites] = await Promise.all([
    database
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
        filledFace: filledFaceColumn(user.id),
        title: shownTitle,
        company: shownCompany,
        location: memberProfile.location,
        companyLogoUrl: companyLogoColumn(user.id),
        groupJoinedAt: memberNetwork.groupJoinedAt,
        pendingVillageEmail: memberNetwork.pendingVillageEmail,
        erasedAt: memberRemoval.erasedAt,
      })
      .from(user)
      .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
      .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
      .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
      .leftJoin(memberRemoval, eq(memberRemoval.userId, user.id))
      .leftJoin(filledTitle.line, filledTitle.joinCondition)
      .leftJoin(filledCompany.line, filledCompany.joinCondition),
    database
      .select({ id: invite.id, email: invite.email, name: invite.inviteeName, company: invite.company, createdAt: invite.createdAt })
      .from(invite)
      .where(and(isNull(invite.acceptedAt), isNull(invite.revokedAt), gt(invite.expiresAt, now)))
      .orderBy(desc(invite.createdAt)),
  ]);
  const memberRows: ConsoleMember[] = members.map((row) => {
    const isRemoved = isBanActive(row, now) || row.erasedAt !== null || isReclaimedEmail(row.email);
    return {
      id: row.id,
      kind: "member",
      name: row.name,
      email: isReclaimedEmail(row.email) ? null : row.email,
      avatarUrl: toShownFaceUrl(row.id, row.avatarUpdatedAt, row.filledFace),
      isAdmin: row.role === MEMBER_ROLES.admin,
      title: row.title,
      company: row.company,
      companyLogoUrl: row.companyLogoUrl,
      location: row.location,
      state: isRemoved ? CONSOLE_MEMBER_STATES.removed : row.groupJoinedAt ? CONSOLE_MEMBER_STATES.connected : CONSOLE_MEMBER_STATES.joined,
      since: row.createdAt.toISOString(),
      isNeedsLook: !isRemoved && (!row.emailVerified || row.pendingVillageEmail !== null),
      deleteRequestedAt: null,
    };
  });
  const inviteRows: ConsoleMember[] = invites.map((row) => ({
    id: row.id,
    kind: "invite",
    name: row.name,
    email: row.email,
    avatarUrl: null,
    isAdmin: false,
    title: null,
    // Founderhall shows "No profile yet" until they sign in; the company still matches a search.
    company: null,
    searchExtra: row.company,
    companyLogoUrl: null,
    location: null,
    state: CONSOLE_MEMBER_STATES.invited,
    since: row.createdAt.toISOString(),
    isNeedsLook: false,
    deleteRequestedAt: null,
  }));
  return [...memberRows, ...inviteRows];
}

// One member, for their Manage page.
export async function readAdminMember(database: Database, memberId: string) {
  const [row] = await selectMembers(database).where(eq(user.id, memberId));
  return row ? memberPageSchema.shape.members.element.parse(toAdminMember(row)) : null;
}

// Admin › Invites: everyone invited who hasn't signed in, while their link still works, newest first.
export async function readOpenInvites(database: Database, now = new Date()) {
  return database
    .select({ id: invite.id, email: invite.email, name: invite.inviteeName, createdAt: invite.createdAt, expiresAt: invite.expiresAt })
    .from(invite)
    .where(and(isNull(invite.acceptedAt), isNull(invite.revokedAt), gt(invite.expiresAt, now)))
    .orderBy(desc(invite.createdAt), asc(invite.email));
}

export type OpenInvite = Awaited<ReturnType<typeof readOpenInvites>>[number];

// How the admin signs an invite: their name and the role on their card.
export async function readInviterSignature(database: Database, memberId: string) {
  const [row] = await database
    .select({ name: user.name, title: memberProfile.title })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .where(eq(user.id, memberId));
  return { name: row?.name ?? "", role: row?.title?.trim() || null };
}
