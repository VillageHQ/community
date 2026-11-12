import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { CompanyFilter, JobList } from "@/modules/job-board/components/job-list";
import { COMPANY_PARAM, JOB_BOARD_PAGE_TITLES, JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { describeEmptyBoard, describeMemberBoard, HIRING_LINE, readCompaniesWithJobs } from "@/modules/job-board/copy";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { readBoardCompanies, readBoardJobs } from "@/modules/job-board/reads";
import { requireMember } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: JOB_BOARD_PAGE_TITLES.board };

type JobsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Founderhall's members' board (memberBoardPage): the head with the hiring line, the Company select, the job rows.
export default modulePage(jobBoardManifest, async function JobsPage({ searchParams }: JobsPageProps) {
  await requireMember();
  const value = (await searchParams)[COMPANY_PARAM];
  const company = typeof value === "string" && value.trim() ? value.trim() : null;
  const database = getDatabase();
  const [jobs, companies, community] = await Promise.all([readBoardJobs(database, company), readBoardCompanies(database), readBrandingForPage()]);
  const current = company ? (companies.find(({ slug }) => slug === company) ?? null) : null;
  if (company && !current) notFound();
  const empty = describeEmptyBoard(current);

  return (
    <>
      <header className="fh-pagehead">
        <h1 className="fh-h1">{current ? `Jobs at ${current.name}` : JOB_BOARD_PAGE_TITLES.board}</h1>
        <p className="fh-lede">{describeMemberBoard({ total: jobs.length, companies, current, communityName: community.name })}</p>
        <p className="fh-small mt-2">
          {HIRING_LINE.before}
          <Link href={JOB_BOARD_PAGES.ours}>{HIRING_LINE.link}</Link>
          {HIRING_LINE.after}
        </p>
      </header>
      <CompanyFilter basePath={JOB_BOARD_PAGES.board} companies={readCompaniesWithJobs(companies)} selected={company} />
      {jobs.length > 0 ? (
        <JobList jobs={jobs} memberHref={(memberId) => `${ROUTES.people}/${memberId}`} />
      ) : (
        <div className="mt-4">
          <EmptyState title={empty.title} description={empty.description} />
        </div>
      )}
    </>
  );
});
