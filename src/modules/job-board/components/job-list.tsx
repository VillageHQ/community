import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company-name";
import { CHIP_CLASSES } from "@/components/ui/chip";
import { formatShortDate } from "@/platform/text/format-date";

import { COMPANY_PARAM, type BoardCompany, type BoardJob, type PublicJob } from "../contract";

type ListedJob = PublicJob & Partial<Pick<BoardJob, "department" | "postedAt" | "memberId" | "memberName" | "companyLogoUrl">>;

export function CompanyFilter({ basePath, companies, selected }: { basePath: string; companies: readonly BoardCompany[]; selected: string | null }) {
  if (companies.length < 2 && selected === null) return null;
  return (
    <nav aria-label="Filter by company" className="mb-5 flex flex-wrap gap-2">
      <Link href={basePath} aria-current={selected === null ? "page" : undefined} className={CHIP_CLASSES}>
        All companies
      </Link>
      {companies.map((company) => (
        <Link
          key={company.slug}
          href={`${basePath}?${new URLSearchParams({ [COMPANY_PARAM]: company.slug }).toString()}`}
          aria-current={selected === company.slug ? "page" : undefined}
          className={CHIP_CLASSES}
        >
          {company.name}
          <span className="text-foreground-soft">{company.jobCount}</span>
        </Link>
      ))}
    </nav>
  );
}

export function JobList({ jobs, memberHref }: { jobs: readonly ListedJob[]; memberHref?: (memberId: string) => string }) {
  return (
    <ul className="grid gap-3">
      {jobs.map((job) => {
        const details = [job.location, job.department].filter(Boolean).join(" · ");
        return (
          <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card-phone bg-card p-card-phone shadow-panel sm:rounded-card sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 className="type-h3 wrap-anywhere">{job.title}</h2>
              <p className="type-small mt-0.5 text-foreground-soft wrap-anywhere">
                <CompanyLogo url={job.companyLogoUrl} className="mr-1.5 mt-0 align-[-0.2em]" />
                {job.company}
                {job.company && details ? " · " : null}
                {details}
              </p>
              {job.memberId && job.memberName && memberHref ? (
                <p className="type-small mt-0.5 text-foreground-soft">
                  Shared by{" "}
                  <Link href={memberHref(job.memberId)} className="font-bold text-brand-emphasis underline underline-offset-3 hover:no-underline">
                    {job.memberName}
                  </Link>
                  {job.postedAt ? ` · ${formatShortDate(job.postedAt)}` : null}
                </p>
              ) : null}
            </div>
            {job.url ? (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-card-phone py-2 text-[15px] font-bold shadow-[inset_0_0_0_1.5px_var(--input)] hover:bg-muted max-sm:w-full max-sm:justify-center"
              >
                Apply
                <ExternalLink aria-hidden="true" className="size-4" />
                <span className="sr-only">
                  {" "}
                  for {job.title} at {job.company} (opens in a new tab)
                </span>
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
