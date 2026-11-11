import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { CompanyName } from "@/components/company-name";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

import { JOB_BOARD_PAGES, type NewJobs } from "../../contract";

function readJobsSentence(total: number) {
  return total === 1 ? "1 new job at the community's companies." : `${total} new jobs at the community's companies.`;
}

// Today: jobs new this week at the community's companies. Nothing shows when there are none.
export function NewJobsCard({ newJobs }: { newJobs: NewJobs }) {
  const { jobs, total } = newJobs;
  if (total === 0) return null;
  return (
    <Card className="sm:p-5">
      <CardTitle>New jobs this week</CardTitle>
      <p className="type-small mt-1.5 text-foreground-soft">{readJobsSentence(total)}</p>
      <ul className="mt-3.5 grid gap-3">
        {jobs.map((job) => (
          <li key={job.id} className="min-w-0">
            {job.url ? (
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="type-label wrap-anywhere hover:underline">
                {job.title}
                <ExternalLink aria-hidden="true" className="ml-1.5 inline size-3.5 align-[-0.1em] text-muted-foreground" />
                <span className="sr-only"> at {job.company} (opens in a new tab)</span>
              </a>
            ) : (
              <span className="type-label wrap-anywhere">{job.title}</span>
            )}
            <div className="type-micro flex flex-wrap items-center gap-x-1 font-medium text-muted-foreground">
              <CompanyName company={job.company} logoUrl={job.companyLogoUrl} logoSizePx={14} />
              {job.location ? <span className="wrap-anywhere">· {job.location}</span> : null}
            </div>
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" size="sm" className="mt-3.5 w-full">
        <Link href={JOB_BOARD_PAGES.board}>See all jobs on the board</Link>
      </Button>
    </Card>
  );
}
