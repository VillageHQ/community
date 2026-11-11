import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/page-header";
import { PublicPage } from "@/components/public-page";
import { CompanyTags, JobList } from "@/modules/job-board/components/job-list";
import { COMPANY_PARAM, JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { describePublicBoard, describePublicTitle, readCompaniesWithJobs } from "@/modules/job-board/copy";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { isPublicBoardOn, readBoardCompanies, readPublicJobs } from "@/modules/job-board/reads";
import { readBrandingForPage } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { readDataHome } from "@/platform/settings/data-home";

export const dynamic = "force-dynamic";

type PublicJobsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function readCompany(searchParams: PublicJobsPageProps["searchParams"]) {
  const value = (await searchParams)[COMPANY_PARAM];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Founderhall's page title stands alone: "Jobs at Northwind Founders companies".
export async function generateMetadata({ searchParams }: PublicJobsPageProps): Promise<Metadata> {
  const [company, companies, community] = await Promise.all([readCompany(searchParams), readBoardCompanies(getDatabase()), readBrandingForPage()]);
  const current = companies.find(({ slug }) => slug === company) ?? null;
  const title = current ? `Jobs at ${current.name} · ${community.name}` : describePublicTitle(community.name, null);
  return { title: { absolute: title } };
}

// For visitors at /jobs (src/proxy.ts sends them here): Founderhall's wide public page. Each job and its company,
// never who shared it. While the board isn't public, a visitor is asked to sign in, as before.
export default modulePage(jobBoardManifest, async function PublicJobsPage({ searchParams }: PublicJobsPageProps) {
  const database = getDatabase();
  if (!(await isPublicBoardOn(database))) redirect(ROUTES.signIn);
  const company = await readCompany(searchParams);
  const [jobs, companies, community, dataHome] = await Promise.all([readPublicJobs(database, company), readBoardCompanies(database), readBrandingForPage(), readDataHome(database)]);
  const current = company ? (companies.find(({ slug }) => slug === company) ?? null) : null;
  if (company && !current) notFound();
  const withJobs = readCompaniesWithJobs(companies);

  return (
    <PublicPage community={community} withCredit hosting={dataHome.location ? `${community.name}, ${dataHome.location}` : undefined} isWide>
      {current ? <BackLink href={JOB_BOARD_PAGES.public}>All companies</BackLink> : null}
      <h1 className="fh-h2">{describePublicTitle(community.name, current)}</h1>
      <p className="fh-lede">{describePublicBoard({ total: jobs.length, companies, current, communityName: community.name })}</p>
      {current ? null : <CompanyTags basePath={JOB_BOARD_PAGES.public} companies={withJobs} />}
      {jobs.length > 0 ? <JobList jobs={jobs} /> : null}
    </PublicPage>
  );
});
