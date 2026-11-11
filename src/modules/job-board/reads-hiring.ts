import "server-only";

import { and, count, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn, type AnyPgTable } from "drizzle-orm/pg-core";

import { isActiveMember } from "@/platform/auth/member-status";
import { user } from "@/platform/database/auth-schema";
import type { DatabaseOrTransaction } from "@/platform/database/client";

import { logoOfCompanyColumn } from "../members/reads-pictures";

import type { CompanyJobs, NewJobs } from "./contract";
import { jobPosting, jobSource } from "./schema";

// A company's jobs, wherever a member or a company shows: the profile, the directory's chip and filter, Today.
// A company's jobs are the listed jobs (source not hidden, linked by an active member) whose source company is the
// member's company, ignoring case and outer spaces.

export const PROFILE_JOB_LIMIT = 5;
export const NEW_JOB_LIMIT = 5;
const NEW_JOB_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const hiringPosting = alias(jobPosting, "hiring_posting");
const hiringSource = alias(jobSource, "hiring_source");
const hiringOwner = alias(user, "hiring_owner");

function fromAlias(table: AnyPgTable, name: string) {
  return sql`${table} ${sql.identifier(name)}`;
}

function isSameCompany(first: SQL | AnyPgColumn, second: SQL | AnyPgColumn) {
  return sql`nullif(trim(${second}), '') is not null and lower(trim(${first})) = lower(trim(${second}))`;
}

// The open jobs at a member's company, as one subquery a directory read can add next to the member.
export function companyJobCountColumn(company: SQL | AnyPgColumn, now = new Date()) {
  return sql<number>`(select count(*)::int from ${fromAlias(jobPosting, "hiring_posting")}
    join ${fromAlias(jobSource, "hiring_source")} on ${hiringSource.id} = ${hiringPosting.sourceId}
    join ${fromAlias(user, "hiring_owner")} on ${hiringOwner.id} = ${hiringSource.memberId}
    where ${hiringSource.hidden} = false and ${isActiveMember(now, hiringOwner)} and ${isSameCompany(hiringSource.company, company)})`.mapWith(Number);
}

function isListedSource(now: Date) {
  return and(eq(jobSource.hidden, false), isActiveMember(now));
}

const NEWEST_FIRST = [sql`coalesce(${jobPosting.postedAt}, ${jobPosting.firstSeenAt}) desc`, desc(jobPosting.id)];

// Up to 5 of a company's open jobs for a profile, and how many there are in all.
export async function readCompanyJobs(database: DatabaseOrTransaction, company: string | null, now = new Date()): Promise<CompanyJobs> {
  const name = company?.trim() ?? "";
  if (!name) return { jobs: [], total: 0, companySlug: null };
  const where = and(isListedSource(now), isSameCompany(jobSource.company, sql`${name}`));
  const [jobs, [counted]] = await Promise.all([
    database
      .select({ id: jobPosting.id, title: jobPosting.title, location: jobPosting.location, url: jobPosting.url, companySlug: jobSource.companySlug })
      .from(jobPosting)
      .innerJoin(jobSource, eq(jobSource.id, jobPosting.sourceId))
      .innerJoin(user, eq(user.id, jobSource.memberId))
      .where(where)
      .orderBy(...NEWEST_FIRST)
      .limit(PROFILE_JOB_LIMIT),
    database
      .select({ total: count() })
      .from(jobPosting)
      .innerJoin(jobSource, eq(jobSource.id, jobPosting.sourceId))
      .innerJoin(user, eq(user.id, jobSource.memberId))
      .where(where),
  ]);
  return {
    jobs: jobs.map(({ companySlug: _slug, ...job }) => job),
    total: counted?.total ?? 0,
    companySlug: jobs[0]?.companySlug ?? null,
  };
}

// Jobs new this week at the community's companies: posted in the last 7 days, or first seen then when the tool gives no date.
export async function readNewJobs(database: DatabaseOrTransaction, now = new Date()): Promise<NewJobs> {
  const since = new Date(now.getTime() - NEW_JOB_WINDOW_MS);
  const where = and(isListedSource(now), gte(sql`coalesce(${jobPosting.postedAt}, ${jobPosting.firstSeenAt})`, since));
  const [jobs, [counted]] = await Promise.all([
    database
      .select({
        id: jobPosting.id,
        title: jobPosting.title,
        location: jobPosting.location,
        url: jobPosting.url,
        company: jobSource.company,
        companySlug: jobSource.companySlug,
        companyLogoUrl: logoOfCompanyColumn(jobSource.company, jobSource.memberId, now),
      })
      .from(jobPosting)
      .innerJoin(jobSource, eq(jobSource.id, jobPosting.sourceId))
      .innerJoin(user, eq(user.id, jobSource.memberId))
      .where(where)
      .orderBy(...NEWEST_FIRST)
      .limit(NEW_JOB_LIMIT),
    database
      .select({ total: count() })
      .from(jobPosting)
      .innerJoin(jobSource, eq(jobSource.id, jobPosting.sourceId))
      .innerJoin(user, eq(user.id, jobSource.memberId))
      .where(where),
  ]);
  return { jobs, total: counted?.total ?? 0 };
}
