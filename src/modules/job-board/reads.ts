import "server-only";

import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import { user } from "@/platform/database/auth-schema";
import type { DatabaseOrTransaction } from "@/platform/database/client";
import { isActiveMember } from "@/platform/auth/member-status";
import { readSettings } from "@/platform/settings/store";

import { memberProfile } from "../members/schema";

import { PUBLIC_BOARD_SETTING, readToolLabel, type BoardCompany, type BoardJob, type JobSourceView, type PublicJob, type SourceJob } from "./contract";
import { jobPosting, jobSource } from "./schema";

const BOARD_LIMIT = 500;

// The public board and the widget are off until an admin turns them on.
export async function isPublicBoardOn(database: DatabaseOrTransaction) {
  const settings = await readSettings(database, [PUBLIC_BOARD_SETTING]);
  return settings.get(PUBLIC_BOARD_SETTING) === "on";
}

// A board lists only sources that aren't hidden, from founders who are still active members.
function isListed(companySlug: string | null): SQL | undefined {
  return and(eq(jobSource.hidden, false), isActiveMember(), companySlug ? eq(jobSource.companySlug, companySlug) : undefined);
}

export async function readBoardJobs(database: DatabaseOrTransaction, companySlug: string | null): Promise<BoardJob[]> {
  const rows = await database
    .select({
      id: jobPosting.id,
      title: jobPosting.title,
      location: jobPosting.location,
      department: jobPosting.department,
      url: jobPosting.url,
      postedAt: jobPosting.postedAt,
      company: jobSource.company,
      companySlug: jobSource.companySlug,
      memberId: user.id,
      memberName: user.name,
    })
    .from(jobPosting)
    .innerJoin(jobSource, eq(jobSource.id, jobPosting.sourceId))
    .innerJoin(user, eq(user.id, jobSource.memberId))
    .where(isListed(companySlug))
    .orderBy(sql`coalesce(${jobPosting.postedAt}, ${jobPosting.updatedAt}) desc`, desc(jobPosting.id))
    .limit(BOARD_LIMIT);
  return rows.map((row) => ({ ...row, postedAt: row.postedAt?.toISOString() ?? null }));
}

// Only the company, title, location and the apply link: never the member who linked it.
export async function readPublicJobs(database: DatabaseOrTransaction, companySlug: string | null): Promise<PublicJob[]> {
  const jobs = await readBoardJobs(database, companySlug);
  return jobs.map(({ id, title, location, url, company, companySlug: slug }) => ({ id, title, location, url, company, companySlug: slug }));
}

export async function readBoardCompanies(database: DatabaseOrTransaction): Promise<BoardCompany[]> {
  const rows = await database
    .select({ slug: jobSource.companySlug, name: sql<string>`min(${jobSource.company})`, jobCount: count(jobPosting.id) })
    .from(jobSource)
    .innerJoin(user, eq(user.id, jobSource.memberId))
    .leftJoin(jobPosting, eq(jobPosting.sourceId, jobSource.id))
    .where(isListed(null))
    .groupBy(jobSource.companySlug)
    .orderBy(sql`lower(min(${jobSource.company}))`);
  return rows.filter(({ jobCount }) => jobCount > 0);
}

async function readSources(database: DatabaseOrTransaction, where: SQL | undefined): Promise<JobSourceView[]> {
  const rows = await database
    .select({
      id: jobSource.id,
      company: jobSource.company,
      companySlug: jobSource.companySlug,
      tool: jobSource.tool,
      slug: jobSource.slug,
      sourceUrl: jobSource.sourceUrl,
      hidden: jobSource.hidden,
      hiddenByAdmin: jobSource.hiddenByAdmin,
      lastPulledAt: jobSource.lastPulledAt,
      lastError: jobSource.lastError,
      jobCount: count(jobPosting.id),
      memberId: user.id,
      memberName: user.name,
    })
    .from(jobSource)
    .innerJoin(user, eq(user.id, jobSource.memberId))
    .leftJoin(jobPosting, eq(jobPosting.sourceId, jobSource.id))
    .where(where)
    .groupBy(jobSource.id, user.id)
    .orderBy(sql`lower(${jobSource.company})`, asc(jobSource.createdAt));
  return rows.map((row) => ({ ...row, toolLabel: readToolLabel(row.tool), lastPulledAt: row.lastPulledAt?.toISOString() ?? null }));
}

export function readMemberSources(database: DatabaseOrTransaction, memberId: string) {
  return readSources(database, eq(jobSource.memberId, memberId));
}

export function readAllSources(database: DatabaseOrTransaction) {
  return readSources(database, undefined);
}

export async function readSourceJobs(database: DatabaseOrTransaction, sourceIds: readonly string[]): Promise<Map<string, SourceJob[]>> {
  const bySource = new Map<string, SourceJob[]>();
  if (sourceIds.length === 0) return bySource;
  const rows = await database
    .select({ id: jobPosting.id, sourceId: jobPosting.sourceId, title: jobPosting.title, location: jobPosting.location, url: jobPosting.url, isManual: jobPosting.isManual })
    .from(jobPosting)
    .where(inArray(jobPosting.sourceId, [...sourceIds]))
    .orderBy(sql`coalesce(${jobPosting.postedAt}, ${jobPosting.updatedAt}) desc`, desc(jobPosting.id));
  for (const { sourceId, ...job } of rows) bySource.set(sourceId, [...(bySource.get(sourceId) ?? []), job]);
  return bySource;
}

// Where a new source's company name starts: the company on the member's card.
export async function readMemberCompany(database: DatabaseOrTransaction, memberId: string) {
  const [row] = await database.select({ company: memberProfile.company }).from(memberProfile).where(eq(memberProfile.userId, memberId));
  return row?.company ?? "";
}
