import { Building2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { toPossessive } from "@/platform/text/day-month";
import { formatDateAndTimeUtc } from "@/platform/text/format-date";

import { JOB_BOARD_LIMITS, JOB_BOARD_PAGES, type JobSourceView, type SourceJob } from "../contract";
import { LinkSourceForm } from "./link-source-form";
import { AddJobForm, RemoveJobButton } from "./manual-jobs";
import { SourceActions } from "./source-actions";

const SHOWN_JOBS = 8;

function plural(count: number, one: string) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : `${one}s`}`;
}

function SourceStatus({ source }: { source: JobSourceView }) {
  if (!source.slug) {
    return <p className="fh-small fh-muted mt-2">{`${source.toolLabel} has no public job feed here, so jobs here are the ones you add by hand.`}</p>;
  }
  const when = source.lastPulledAt ? `${source.lastError ? "Last tried" : "Last pulled"} ${formatDateAndTimeUtc(source.lastPulledAt)}` : "Not pulled yet";
  return (
    <>
      {source.lastError ? (
        <p role="status" className="fh-note fh-needs mt-2.5">
          <span>
            {source.lastError}
            {source.jobCount > 0 ? ` The ${plural(source.jobCount, "job")} below ${source.jobCount === 1 ? "is" : "are"} from the last pull that worked.` : null}
          </span>
        </p>
      ) : null}
      <p className="fh-small fh-muted mt-2">{`${when} · from ${source.toolLabel}, board “${source.slug}” · pulled every hour`}</p>
    </>
  );
}

function readEmptyLine(source: JobSourceView) {
  if (!source.slug) return "No jobs added yet.";
  return source.lastPulledAt && !source.lastError ? "No open jobs on that board right now." : "";
}

// One linked company (Founderhall's sourceBlock): its name, how it is pulled, its jobs, then Pull now · Hide · Remove.
function SourceBlock({ source, jobs }: { source: JobSourceView; jobs: readonly SourceJob[] }) {
  const shown = jobs.slice(0, SHOWN_JOBS);
  const isLockedByAdmin = source.hiddenByAdmin;
  return (
    <div className="fh-jobsource" id={`source-${source.id}`}>
      <div className="mt-3.5 flex items-baseline justify-between gap-3">
        <h3 className="fh-h3">
          {source.company}
          {source.hidden ? (
            <>
              {" "}
              <Pill tone="declined">{source.hiddenByAdmin ? "Hidden by an admin" : "Hidden from the board"}</Pill>
            </>
          ) : null}
        </h3>
        <span className="fh-small fh-muted">{plural(source.jobCount, "open job")}</span>
      </div>
      <SourceStatus source={source} />
      {isLockedByAdmin ? <p className="fh-small fh-muted mt-2">An admin hid these jobs from every board. Ask an admin if you think that’s a mistake.</p> : null}
      {shown.length > 0 ? (
        <div className="fh-rows fh-jobrows mt-2.5">
          {shown.map((job) => (
            <div key={job.id} className="fh-r">
              <span>
                <Building2 aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
              </span>
              <div className="fh-who">
                <b>{job.title}</b>
                <span>{`${job.location}${job.isManual ? `${job.location ? " · " : ""}added by hand` : ""}` || " "}</span>
              </div>
              <div className="fh-end">
                {job.isManual ? (
                  <RemoveJobButton sourceId={source.id} jobId={job.id} title={job.title} />
                ) : job.url ? (
                  <Button asChild variant="quiet" size="sm">
                    <a href={job.url} target="_blank" rel="noopener noreferrer">
                      Open
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="fh-small mt-2.5">{readEmptyLine(source)}</p>
      )}
      {jobs.length > shown.length ? (
        <p className="fh-small fh-muted mt-2">
          And {(jobs.length - shown.length).toLocaleString("en-US")} more on <Link href={JOB_BOARD_PAGES.board}>the board</Link>.
        </p>
      ) : null}
      {source.slug ? null : <AddJobForm sourceId={source.id} isOpen={jobs.length === 0} />}
      <div className="mt-3">
        <SourceActions sourceId={source.id} company={source.company} hidden={source.hidden} canPull={source.slug !== null} canToggleHidden={!isLockedByAdmin} canRemove />
      </div>
    </div>
  );
}

type OurJobsSectionProps = {
  sources: readonly JobSourceView[];
  jobsBySource: ReadonlyMap<string, readonly SourceJob[]>;
  company: string;
  isCompanyFixed: boolean;
  communityName: string;
  isPublicBoardOn: boolean;
};

// Founderhall's "Our jobs" sheet on My profile (ourJobsSection): the line, each linked company, then the form to link
// one (folded under "Add another company or board" once one is linked). Its anchor is #jobs.
export function OurJobsSection({ sources, jobsBySource, company, isCompanyFixed, communityName, isPublicBoardOn }: OurJobsSectionProps) {
  const canAddMore = sources.length < JOB_BOARD_LIMITS.sourcesPerMember;
  const form = <LinkSourceForm defaultCompany={company} isCompanyFixed={isCompanyFixed} />;
  return (
    <section className="fh-sheet fh-section" id="jobs" aria-labelledby="our-jobs-title">
      <div className="fh-sheet-head">
        <h2 id="our-jobs-title" className="fh-h3 flex items-center gap-2">
          <Building2 aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} /> Our jobs
        </h2>
        <Link href={JOB_BOARD_PAGES.board}>The job board</Link>
      </div>
      <p className="fh-small">
        {`Hiring? Members see your open jobs on ${toPossessive(communityName)} job board${isPublicBoardOn ? ", and so does its public jobs page" : ""}. People apply on your own job pages.`}
      </p>
      {sources.map((source) => (
        <SourceBlock key={source.id} source={source} jobs={jobsBySource.get(source.id) ?? []} />
      ))}
      {!canAddMore ? (
        <p className="fh-small fh-muted mt-4">{`You’ve linked ${JOB_BOARD_LIMITS.sourcesPerMember} companies or boards, the most one member can. Remove one to link another.`}</p>
      ) : sources.length > 0 ? (
        <details className="fh-fix mt-4">
          <summary className="fh-small cursor-pointer">Add another company or board</summary>
          <div className="mt-3">{form}</div>
        </details>
      ) : (
        <div className="mt-3">{form}</div>
      )}
    </section>
  );
}
