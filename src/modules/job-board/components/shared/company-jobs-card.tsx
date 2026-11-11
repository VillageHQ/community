import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

import { toCompanyBoardHref, type CompanyJobs } from "../../contract";
import { ApplyLink } from "./apply-link";

function readSeeAllLabel(total: number) {
  return total === 1 ? "See the job" : `See all ${total} jobs`;
}

// A member's profile: their company's open jobs, up to 5, then the board filtered to the company.
export function CompanyJobsCard({ company, companyJobs }: { company: string; companyJobs: CompanyJobs }) {
  const { jobs, total, companySlug } = companyJobs;
  if (total === 0) return null;
  return (
    <Card>
      <CardTitle>Open jobs at {company}</CardTitle>
      <ul className="mt-3.5 grid gap-2.5">
        {jobs.map((job) => (
          <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-field bg-muted px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="type-label wrap-anywhere">{job.title}</p>
              {job.location ? <p className="type-small wrap-anywhere text-foreground-soft">{job.location}</p> : null}
            </div>
            {job.url ? <ApplyLink url={job.url} title={job.title} company={company} /> : null}
          </li>
        ))}
      </ul>
      {total > jobs.length && companySlug ? (
        <Button asChild variant="outline" size="sm" className="mt-3.5 max-sm:w-full">
          <Link href={toCompanyBoardHref(companySlug)}>
            {readSeeAllLabel(total)}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </Card>
  );
}
