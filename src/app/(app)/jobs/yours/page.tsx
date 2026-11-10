import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { LinkSourceForm } from "@/modules/job-board/components/link-source-form";
import { AddJobForm, RemoveJobButton } from "@/modules/job-board/components/manual-jobs";
import { SourceCard } from "@/modules/job-board/components/source-card";
import { JOB_BOARD_LIMITS, JOB_BOARD_PAGE_TITLES } from "@/modules/job-board/contract";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { readMemberCompany, readMemberSources, readSourceJobs } from "@/modules/job-board/reads";
import { requireMember } from "@/platform/auth/session";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: JOB_BOARD_PAGE_TITLES.yours };

export default modulePage(jobBoardManifest, async function YourJobsPage() {
  const member = await requireMember();
  const database = getDatabase();
  const [sources, company] = await Promise.all([readMemberSources(database, member.id), readMemberCompany(database, member.id)]);
  const jobsBySource = await readSourceJobs(database, sources.map(({ id }) => id));
  const canAddMore = sources.length < JOB_BOARD_LIMITS.sourcesPerMember;

  return (
    <>
      <PageHeader title={JOB_BOARD_PAGE_TITLES.yours} description="Link your hiring tool once. Your open jobs stay up to date on the board by themselves." />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-5">
          {sources.length === 0 ? (
            <Card>
              <CardDescription>Nothing linked yet. Your jobs show up here, and on the board, as soon as you link your hiring tool.</CardDescription>
            </Card>
          ) : null}
          {sources.map((source) => {
            const manualJobs = (jobsBySource.get(source.id) ?? []).filter(({ isManual }) => isManual);
            return (
              <SourceCard key={source.id} source={source} canRemove showMember={false}>
                {manualJobs.length > 0 ? (
                  <ul className="grid gap-2">
                    {manualJobs.map((job) => (
                      <li key={job.id} className="flex items-center justify-between gap-3 rounded-field bg-muted px-4 py-2">
                        <span className="min-w-0 wrap-anywhere">
                          <span className="font-bold">{job.title}</span>
                          {job.location ? <span className="text-foreground-soft"> · {job.location}</span> : null}
                        </span>
                        <RemoveJobButton sourceId={source.id} jobId={job.id} title={job.title} />
                      </li>
                    ))}
                  </ul>
                ) : null}
                <AddJobForm sourceId={source.id} isOpen={source.slug === null && manualJobs.length === 0} />
              </SourceCard>
            );
          })}
        </div>
        <Card className="grid gap-3.5">
          <CardTitle>Link your company</CardTitle>
          {canAddMore ? (
            <LinkSourceForm defaultCompany={company} />
          ) : (
            <CardDescription>You&apos;ve linked {JOB_BOARD_LIMITS.sourcesPerMember} sources, the most one member can. Remove one to link another.</CardDescription>
          )}
        </Card>
      </div>
    </>
  );
});
