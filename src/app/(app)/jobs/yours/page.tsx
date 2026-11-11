import type { Metadata } from "next";

import { BackLink } from "@/components/page-header";
import { OurJobsSection } from "@/modules/job-board/components/our-jobs-section";
import { JOB_BOARD_PAGE_TITLES, JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { isPublicBoardOn, readMemberCompany, readMemberSources, readSourceJobs } from "@/modules/job-board/reads";
import { isAdminMember } from "@/platform/auth/roles";
import { requireMember } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: JOB_BOARD_PAGE_TITLES.yours };

// Founderhall keeps a founder's job tools in the "Our jobs" sheet on My profile. Until My profile carries it, this page
// shows the same sheet on its own (the board's "Add your company's jobs" link comes here).
export default modulePage(jobBoardManifest, async function YourJobsPage() {
  const member = await requireMember();
  const database = getDatabase();
  const [sources, company, community, isPublic] = await Promise.all([
    readMemberSources(database, member.id),
    readMemberCompany(database, member.id),
    readBrandingForPage(),
    isPublicBoardOn(database),
  ]);
  const jobsBySource = await readSourceJobs(database, sources.map(({ id }) => id));

  return (
    <div className="max-w-[720px]">
      <BackLink href={JOB_BOARD_PAGES.board}>Jobs</BackLink>
      <h1 className="sr-only">{JOB_BOARD_PAGE_TITLES.yours}</h1>
      <OurJobsSection sources={sources} jobsBySource={jobsBySource} company={company} isCompanyFixed={!isAdminMember(member)} communityName={community.name} isPublicBoardOn={isPublic} />
    </div>
  );
});
