import { CircleAlert, EyeOff } from "lucide-react";
import type { ReactNode } from "react";

import { ExternalTextLink } from "@/components/external-text-link";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { formatDateAndTimeUtc } from "@/platform/text/format-date";

import type { JobSourceView } from "../contract";
import { SourceActions } from "./source-actions";

function describeStatus(source: JobSourceView) {
  const jobs = `${source.jobCount} open ${source.jobCount === 1 ? "job" : "jobs"}`;
  if (!source.slug) return `${jobs}, added by hand.`;
  if (!source.lastPulledAt) return `${jobs}. Not pulled yet.`;
  return `${jobs}. Last pulled ${formatDateAndTimeUtc(source.lastPulledAt)}.`;
}

type SourceCardProps = { source: JobSourceView; canRemove: boolean; showMember: boolean; children?: ReactNode };

export function SourceCard({ source, canRemove, showMember, children }: SourceCardProps) {
  return (
    <Card className="grid gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="wrap-anywhere">{source.company}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {source.hidden ? (
            <Tag tone="gold">
              <EyeOff aria-hidden="true" />
              Hidden
            </Tag>
          ) : null}
          <Tag>{source.toolLabel}</Tag>
        </div>
      </div>
      <p className="type-small text-foreground-soft">
        {describeStatus(source)}
        {showMember ? ` Linked by ${source.memberName}.` : null}
        {source.sourceUrl ? (
          <>
            {" "}
            <ExternalTextLink href={source.sourceUrl}>Careers page</ExternalTextLink>
          </>
        ) : null}
      </p>
      {source.lastError ? (
        <p role="status" className="type-small flex gap-2 rounded-field bg-destructive-soft px-4 py-3 text-destructive-text">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            The last pull didn&apos;t work: {source.lastError}
            {source.jobCount > 0 ? " The jobs from the last pull that worked stay on the board." : null}
          </span>
        </p>
      ) : null}
      {children}
      <SourceActions sourceId={source.id} company={source.company} hidden={source.hidden} canPull={source.slug !== null} canRemove={canRemove} />
    </Card>
  );
}
