import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LogoTile } from "@/components/logo-tile";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { CompanyFilter, JobList } from "@/modules/job-board/components/job-list";
import { COMPANY_PARAM, JOB_BOARD_PAGE_TITLES, JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { isPublicBoardOn, readBoardCompanies, readPublicJobs } from "@/modules/job-board/reads";
import { readBrandingForPage } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: JOB_BOARD_PAGE_TITLES.public };

type PublicJobsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// For visitors: no session needed. Only the company, title, location and apply link of each job, never who shared it.
export default modulePage(jobBoardManifest, async function PublicJobsPage({ searchParams }: PublicJobsPageProps) {
  const database = getDatabase();
  if (!(await isPublicBoardOn(database))) notFound();
  const value = (await searchParams)[COMPANY_PARAM];
  const company = typeof value === "string" && value.trim() ? value.trim() : null;
  const [jobs, companies, community] = await Promise.all([readPublicJobs(database, company), readBoardCompanies(database), readBrandingForPage()]);

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className="mx-auto grid w-full max-w-[880px] gap-6 px-3.5 py-10 sm:px-6">
      <header className="grid gap-4">
        <div className="flex items-center gap-3 text-lg font-bold tracking-[-0.012em]">
          <LogoTile name={community.name} logo={community.logo} />
          {community.name}
        </div>
        <div>
          <h1 className="type-h1">Jobs at {community.name} companies</h1>
          <p className="type-lead mt-1.5 text-foreground-soft">Open roles at the companies in our community. Apply on each company&apos;s own site.</p>
        </div>
      </header>
      <div>
        <CompanyFilter basePath={JOB_BOARD_PAGES.public} companies={companies} selected={company} />
        {jobs.length > 0 ? <JobList jobs={jobs} /> : <p className="type-lead text-foreground-soft">No open jobs right now. Check back soon.</p>}
      </div>
    </main>
  );
});
