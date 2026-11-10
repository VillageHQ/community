import { BriefcaseBusiness } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CompanyFilter, JobList } from "@/modules/job-board/components/job-list";
import { COMPANY_PARAM, JOB_BOARD_PAGE_TITLES, JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { readBoardCompanies, readBoardJobs } from "@/modules/job-board/reads";
import { requireMember } from "@/platform/auth/session";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: JOB_BOARD_PAGE_TITLES.board };

type JobsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default modulePage(jobBoardManifest, async function JobsPage({ searchParams }: JobsPageProps) {
  await requireMember();
  const value = (await searchParams)[COMPANY_PARAM];
  const company = typeof value === "string" && value.trim() ? value.trim() : null;
  const database = getDatabase();
  const [jobs, companies] = await Promise.all([readBoardJobs(database, company), readBoardCompanies(database)]);
  const yoursButton = (
    <Button asChild variant="outline" className="max-sm:w-full">
      <Link href={JOB_BOARD_PAGES.yours}>Your company&apos;s jobs</Link>
    </Button>
  );

  return (
    <>
      <PageHeader title={JOB_BOARD_PAGE_TITLES.board} description="Open jobs at the community's companies." action={yoursButton} />
      <CompanyFilter basePath={JOB_BOARD_PAGES.board} companies={companies} selected={company} />
      {jobs.length > 0 ? (
        <JobList jobs={jobs} memberHref={(memberId) => `${ROUTES.members}/${memberId}`} />
      ) : (
        <EmptyState
          icon={BriefcaseBusiness}
          title={company ? "No open jobs at this company" : "No open jobs yet"}
          description="Founders link their company's hiring tool, and its open jobs show up here within the hour."
        >
          <Button asChild>
            <Link href={JOB_BOARD_PAGES.yours}>Add your company&apos;s jobs</Link>
          </Button>
        </EmptyState>
      )}
    </>
  );
});
