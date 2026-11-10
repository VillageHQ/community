import "server-only";

import { and, asc, count, desc, eq, exists, gte, ilike, inArray, min, ne, or, sql } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberAvatar, memberProfile, memberTag } from "./schema.ts";
import { type Directory, type DirectoryFilters, normalizeTag } from "./contract-profile.ts";
import { EMPTY_DIRECTORY_FILTERS } from "./rules-directory-url.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { toAvatarUrl } from "./service-profile.ts";
import { FILL_IN_FIELDS } from "./contract-fill-in.ts";
import { shownFillInColumn } from "./service-fill-in.ts";
import { isListedMember } from "./service-privacy.ts";

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

// A whole value, ignoring case and outer spaces: "seed" finds "Seed", never "Pre-seed".
function matchesValue(column: typeof memberProfile.stage | typeof memberProfile.sector | typeof memberProfile.cohort, value: string) {
  if (!value) return undefined;
  return sql`lower(trim(${column})) = ${value.toLowerCase()}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isUpdatedWithin(days: number, now: Date) {
  if (!days) return undefined;
  return gte(memberProfile.updatedAt, new Date(now.getTime() - days * DAY_MS));
}

// The values active members use, one spelling per value whatever its case, sorted for the filter menus.
async function readValuesInUse(database: Database, column: typeof memberProfile.stage | typeof memberProfile.sector | typeof memberProfile.cohort) {
  const normalized = sql<string>`lower(trim(${column}))`;
  const rows = await database
    .select({ label: min(sql<string>`trim(${column})`) })
    .from(memberProfile)
    .innerJoin(user, eq(user.id, memberProfile.userId))
    .where(and(isActiveMember(), sql`nullif(trim(${column}), '') is not null`))
    .groupBy(normalized)
    .orderBy(normalized);
  return rows.flatMap(({ label }) => (label ? [label] : []));
}

async function readFilterOptions(database: Database) {
  const [stage, sector, cohort] = await Promise.all([
    readValuesInUse(database, memberProfile.stage),
    readValuesInUse(database, memberProfile.sector),
    readValuesInUse(database, memberProfile.cohort),
  ]);
  return { stage, sector, cohort };
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
    .where(and(isActiveMember(), isListedMember()))
    .groupBy(memberTag.normalizedTag)
    .orderBy(desc(tagCount), asc(memberTag.normalizedTag))
    .limit(MAXIMUM_POPULAR_TAGS);
  return tags.map(({ value, label }) => ({ value, label: label ?? value }));
}

// Active members per cohort, for the partner report. A cohort is one value whatever its case or outer spaces.
export async function readCohortMemberCounts(database: Database) {
  const cohortKey = sql<string>`lower(trim(${memberProfile.cohort}))`;
  const rows = await database
    .select({ key: cohortKey, label: min(sql<string>`trim(${memberProfile.cohort})`), members: count() })
    .from(memberProfile)
    .innerJoin(user, eq(user.id, memberProfile.userId))
    .where(and(isActiveMember(), sql`nullif(trim(${memberProfile.cohort}), '') is not null`))
    .groupBy(cohortKey)
    .orderBy(cohortKey);
  return rows.map(({ key, label, members }) => ({ key, label: label ?? key, members }));
}

export async function readActiveMemberCount(database: Database) {
  const [row] = await database.select({ memberCount: count() }).from(user).where(isActiveMember());
  return row?.memberCount ?? 0;
}

// Who the directory lists: active members who didn't choose "hide me from the directory". Posts outside the app
// (Slack, Discord) name only members it lists; others are "a member".
export function isListedInDirectory(now = new Date()) {
  return and(isActiveMember(now), isListedMember());
}

export async function readDirectory(database: Database, filters: Partial<DirectoryFilters>, now = new Date()): Promise<Directory> {
  const { search, tag, stage, sector, cohort, updatedWithinDays, page } = { ...EMPTY_DIRECTORY_FILTERS, ...filters };
  const conditions = and(
    isListedInDirectory(now),
    matchesSearch(database, search),
    matchesTag(database, tag),
    matchesValue(memberProfile.stage, stage),
    matchesValue(memberProfile.sector, sector),
    matchesValue(memberProfile.cohort, cohort),
    isUpdatedWithin(updatedWithinDays, now),
  );
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
      stage: memberProfile.stage,
      sector: memberProfile.sector,
      cohort: memberProfile.cohort,
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

  const [tagsByMember, popularTags, memberCount, filterOptions] = await Promise.all([
    readTagsByMember(database, rows.map(({ id }) => id)),
    readPopularTags(database),
    readActiveMemberCount(database),
    readFilterOptions(database),
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
    filterOptions,
  };
}

export function readMemberNeighbours(database: Database, excludedMemberId: string) {
  return database
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(ne(user.id, excludedMemberId), isActiveMember(), isListedMember()))
    .orderBy(desc(user.createdAt), asc(user.id))
    .limit(MAXIMUM_NEIGHBOURS);
}

export async function readNewMembers(database: Database, excludedMemberId: string, now = new Date()) {
  const isNewAndActive = and(
    gte(user.createdAt, new Date(now.getTime() - NEW_MEMBER_WINDOW_MS)),
    ne(user.id, excludedMemberId),
    isActiveMember(now),
    isListedMember(),
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
