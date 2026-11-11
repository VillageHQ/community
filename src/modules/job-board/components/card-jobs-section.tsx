import Link from "next/link";

import { Button } from "@/components/ui/button";

import { JOB_BOARD_LIMITS, JOB_BOARD_PAGES, type JobSourceView } from "../contract";
import { LinkSourceForm } from "./link-source-form";

function describeSource(source: JobSourceView) {
  const jobs = `${source.jobCount} open ${source.jobCount === 1 ? "job" : "jobs"}`;
  return `${source.toolLabel} · ${jobs}${source.hidden ? " · hidden" : ""}`;
}

type CardJobsSectionProps = { sources: readonly JobSourceView[]; company: string; isCompanyFixed: boolean };

// The card page: link the company's hiring tool here too (the same link as Your company's jobs), or see what is linked.
export function CardJobsSection({ sources, company, isCompanyFixed }: CardJobsSectionProps) {
  // A founder shares jobs only for the company on their card, so without one there is nothing to link yet.
  const isCompanyMissing = sources.length === 0 && isCompanyFixed && company.trim() === "";
  return (
    <section aria-labelledby="card-jobs-title" className="mt-5 grid gap-4 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
      <div className="grid gap-1">
        <h2 id="card-jobs-title" className="type-h3">
          Your company&apos;s jobs
        </h2>
        <p className="type-small text-foreground-soft">
          {isCompanyMissing
            ? "Add your company to your card above and save. Then paste your careers link here, and your open jobs show on your profile and the job board."
            : sources.length === 0
              ? "Paste your careers link and your open jobs show on your profile and the job board, kept up to date every hour."
              : "Your open jobs show on your profile and the job board."}
        </p>
      </div>
      {sources.length > 0 ? (
        <>
          <ul className="grid gap-2">
            {sources.map((source) => (
              <li key={source.id} className="rounded-field bg-muted px-4 py-3">
                <p className="type-label wrap-anywhere">{source.company}</p>
                <p className="type-small text-foreground-soft">{describeSource(source)}</p>
                {source.lastError ? <p className="type-small mt-1 text-destructive-text">The last pull didn&apos;t work: {source.lastError}</p> : null}
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" size="sm" className="justify-self-start max-sm:w-full">
            <Link href={JOB_BOARD_PAGES.yours}>{sources.length < JOB_BOARD_LIMITS.sourcesPerMember ? "Manage or link another" : "Manage your jobs"}</Link>
          </Button>
        </>
      ) : isCompanyMissing ? null : (
        <LinkSourceForm defaultCompany={company} isCompanyFixed={isCompanyFixed} />
      )}
    </section>
  );
}
