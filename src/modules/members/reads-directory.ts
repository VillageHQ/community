import "server-only";

import { and, asc, count, desc, eq, exists, gte, ilike, inArray, min, ne, or, sql } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberAvatar, memberProfile, memberTag } from "./schema.ts";
import { type Directory, type DirectoryFilters, normalizeTag } from "./contract-profile.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { toAvatarUrl } from "./service-profile.ts";
import { FILL_IN_FIELDS } from "./contract-fill-in.ts";
import { shownFillInColumn } from "./service-fill-in.ts";

export const DIRECTORY_PAGE_SIZE = 12;

// Lists show a filled-in role, company and face where the member left theirs empty.
const filledTitle = shownFillInColumn(FILL_IN_FIELDS.title);
const filledCompany = shownFillInColumn(FILL_IN_FIELDS.company);
const filledFace = shownFillInColumn(FILL_IN_FIELDS.face);

const shownTitle = sql<string | null>`coalesce(nullif(${memberProfile.title}, ''), ${filledTitle.line.value})`;
const shownCompany = sql<string | null>`coalesce(nullif(${memberProfile.company}, ''), ${filledCompany.line.value})`;

function toListAvatarUrl(memberId: string, avatarUpdatedAt: Date | null, filledFaceUrl: string | null) {
  return toAvatarUrl(memberId, avatarUpdatedAt) ?? filledFaceUrl;
}
const MAXIMUM_POPULAR_TAGS = 6;
const MAXIMUM_NEW_MEMBERS = 3;
const MAXIMUM_NEIGHBOURS = 6;
const NEW_MEMBER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LIKE_WILDCARDS = /[\\%_]/g;

export function toContainsPattern(search: string) {
  return `%${search.replace(LIKE_WILDCARDS, "\\$&")}%`;
}

function matchesSearch(database: Database, search: string) {
  if (!search) return undefined;
  const pattern = toContainsPattern(search);
  const taggedMember = database
    .select({ userId: memberTag.userId })
    .from(memberTag)
    .where(and(eq(memberTag.userId, user.id), ilike(memberTag.tag, pattern)));
  return or(
    ilike(user.name, pattern),
    ilike(memberProfile.company, pattern),
    ilike(memberProfile.canHelpWith, pattern),
    exists(taggedMember),
  );
}

function matchesTag(database: Database, tag: string) {
  if (!tag) return undefined;
  const taggedMember = database
    .select({ userId: memberTag.userId })
    .from(memberTag)
    .where(and(eq(memberTag.userId, user.id), eq(memberTag.normalizedTag, normalizeTag(tag))));
  return exists(taggedMember);
}

async function readTagsByMember(database: Database, memberIds: string[]) {
  const tagsByMember = new Map<string, string[]>();
  if (memberIds.length === 0) return tagsByMember;

  const tags = await database
    .select({ userId: memberTag.userId, tag: memberTag.tag })
    .from(memberTag)
    .where(inArray(memberTag.userId, memberIds))
    .orderBy(memberTag.tag);
  for (const { userId, tag } of tags) tagsByMember.set(userId, [...(tagsByMember.get(userId) ?? []), tag]);
  return tagsByMember;
}

async function readPopularTags(database: Database) {
  const tagCount = count();
  const tags = await database
    .select({ value: memberTag.normalizedTag, label: min(memberTag.tag), tagCount })
    .from(memberTag)
    .innerJoin(user, eq(user.id, memberTag.userId))
    .where(isActiveMember())
    .groupBy(memberTag.normalizedTag)
    .orderBy(desc(tagCount), asc(memberTag.normalizedTag))
    .limit(MAXIMUM_POPULAR_TAGS);
  return tags.map(({ value, label }) => ({ value, label: label ?? value }));
}

export async function readActiveMemberCount(database: Database) {
  const [row] = await database.select({ memberCount: count() }).from(user).where(isActiveMember());
  return row?.memberCount ?? 0;
}

export async function readDirectory(database: Database, { search, tag, page }: DirectoryFilters): Promise<Directory> {
  const conditions = and(isActiveMember(), matchesSearch(database, search), matchesTag(database, tag));
  const [counted] = await database
    .select({ matchCount: count() })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .where(conditions);
  const matchCount = counted?.matchCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(matchCount / DIRECTORY_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  const rows = await database
    .select({
      id: user.id,
      name: user.name,
      title: shownTitle,
      company: shownCompany,
      canHelpWith: memberProfile.canHelpWith,
      avatarUpdatedAt: memberAvatar.updatedAt,
      filledFaceUrl: filledFace.line.value,
    })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
    .leftJoin(filledTitle.line, filledTitle.joinCondition)
    .leftJoin(filledCompany.line, filledCompany.joinCondition)
    .leftJoin(filledFace.line, filledFace.joinCondition)
    .where(conditions)
    .orderBy(asc(user.name), asc(user.id))
    .limit(DIRECTORY_PAGE_SIZE)
    .offset((currentPage - 1) * DIRECTORY_PAGE_SIZE);

  const [tagsByMember, popularTags, memberCount] = await Promise.all([
    readTagsByMember(database, rows.map(({ id }) => id)),
    readPopularTags(database),
    readActiveMemberCount(database),
  ]);

  return {
    members: rows.map(({ avatarUpdatedAt, filledFaceUrl, ...member }) => ({
      ...member,
      avatarUrl: toListAvatarUrl(member.id, avatarUpdatedAt, filledFaceUrl),
      tags: tagsByMember.get(member.id) ?? [],
    })),
    matchCount,
    memberCount,
    page: currentPage,
    pageCount,
    popularTags,
  };
}

export function readMemberNeighbours(database: Database, excludedMemberId: string) {
  return database
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(ne(user.id, excludedMemberId), isActiveMember()))
    .orderBy(desc(user.createdAt), asc(user.id))
    .limit(MAXIMUM_NEIGHBOURS);
}

export async function readNewMembers(database: Database, excludedMemberId: string, now = new Date()) {
  const isNewAndActive = and(
    gte(user.createdAt, new Date(now.getTime() - NEW_MEMBER_WINDOW_MS)),
    ne(user.id, excludedMemberId),
    isActiveMember(now),
  );
  const [[counted], rows] = await Promise.all([
    database.select({ newCount: count() }).from(user).where(isNewAndActive),
    database
      .select({
        id: user.id,
        name: user.name,
        title: memberProfile.title,
        company: memberProfile.company,
        avatarUpdatedAt: memberAvatar.updatedAt,
      })
      .from(user)
      .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
      .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
      .where(isNewAndActive)
      .orderBy(desc(user.createdAt), asc(user.id))
      .limit(MAXIMUM_NEW_MEMBERS),
  ]);
  return {
    newCount: counted?.newCount ?? 0,
    newMembers: rows.map(({ avatarUpdatedAt, ...member }) => ({
      ...member,
      avatarUrl: toAvatarUrl(member.id, avatarUpdatedAt),
    })),
  };
}
