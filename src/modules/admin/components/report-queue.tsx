"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Flag, Lock, ShieldCheck, Trash2, UserRoundX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { QueryBoundary } from "@/components/query-boundary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Tag } from "@/components/ui/tag";
import {
  REPORT_FILTERS,
  REPORT_RESOLUTIONS,
  REPORT_TARGETS,
  type Report,
  type ReportFilter,
  type ReportResolution,
  type ReportTarget,
} from "@/modules/admin/contract";
import { readFirstName } from "@/platform/design/avatar-identity";
import { formatDateAndTimeUtc, formatLongDate } from "@/platform/text/format-date";

import { asksManifest } from "@/modules/asks/manifest";
import { feedManifest } from "@/modules/feed/manifest";
import { introsManifest } from "@/modules/intros/manifest";
import { messagesManifest } from "@/modules/messages/manifest";
import { useIsModuleEnabled } from "@/platform/modules/enabled-modules";
import { ConfirmDialog } from "@/modules/admin/components/confirm-dialog";
import { RemoveMemberDialog } from "@/modules/admin/components/remove-member-dialog";
import { deleteReportedContentRequest, dismissReportRequest, REPORT_QUERY_KEYS, reportPageQuery } from "@/modules/admin/queries-reports";

const QUEUE_TITLE_ID = "report-queue-title";
const UNKNOWN_PERSON = "Someone who's no longer here";

const TARGET_DISPLAY: Record<ReportTarget, { label: string; scope: string; deleteLabel: string | null }> = {
  [REPORT_TARGETS.post]: { label: "Post", scope: "This is the post as it was when reported. They may have edited it since.", deleteLabel: "Delete this post" },
  [REPORT_TARGETS.comment]: { label: "Reply", scope: "This is the reply as it was when reported. They may have edited it since.", deleteLabel: "Delete this reply" },
  [REPORT_TARGETS.directMessage]: {
    label: "Direct message",
    scope: "You're seeing a copy of this one message, and nothing else from the conversation. You can't delete messages from here.",
    deleteLabel: null,
  },
  [REPORT_TARGETS.introNote]: {
    label: "Intro note",
    scope: "You're seeing a copy of this note, and nothing else about the intro request. You can't delete notes from here.",
    deleteLabel: null,
  },
  [REPORT_TARGETS.ask]: {
    label: "Ask",
    scope: "This is the ask as it was when reported. Offers stay private to the asker.",
    deleteLabel: "Remove this ask",
  },
  [REPORT_TARGETS.askAnswer]: {
    label: "Answer on an ask",
    scope: "This is the answer as it was when reported, with the title of the ask it was under.",
    deleteLabel: "Remove this answer",
  },
};

const DELETION_NOTES: Partial<Record<ReportTarget, string>> = {
  [REPORT_TARGETS.post]: "It's gone for everyone, along with its replies. A copy stays in the audit log. The author isn't told.",
  [REPORT_TARGETS.comment]: "It's gone for everyone. A copy stays in the audit log. Its author isn't told.",
  [REPORT_TARGETS.ask]: "It's gone for everyone, along with its offers. A copy stays in the audit log. Its author isn't told.",
  [REPORT_TARGETS.askAnswer]: "It's gone for everyone. A copy stays in the audit log. Its author isn't told.",
};

const TARGET_FEATURES: Record<ReportTarget, { id: string; label: string }> = {
  [REPORT_TARGETS.post]: feedManifest,
  [REPORT_TARGETS.comment]: feedManifest,
  [REPORT_TARGETS.directMessage]: messagesManifest,
  [REPORT_TARGETS.introNote]: introsManifest,
  [REPORT_TARGETS.ask]: asksManifest,
  [REPORT_TARGETS.askAnswer]: asksManifest,
};

const RESOLUTION_LABELS: Record<ReportResolution, string> = {
  [REPORT_RESOLUTIONS.dismissed]: "Dismissed",
  [REPORT_RESOLUTIONS.contentDeleted]: "Content deleted",
  [REPORT_RESOLUTIONS.memberRemoved]: "Member removed",
};

const FILTER_CHIPS: { filter: ReportFilter; label: string }[] = [
  { filter: REPORT_FILTERS.open, label: "Open" },
  { filter: REPORT_FILTERS.resolved, label: "Handled" },
];

const EMPTY_STATES: Record<ReportFilter, { title: string; description: string }> = {
  [REPORT_FILTERS.open]: { title: "Nothing to review", description: "When a member reports a post, a reply, a message or an intro note, it shows up here." },
  [REPORT_FILTERS.resolved]: { title: "Nothing handled yet", description: "Reports you've dealt with stay here, so you can look back." },
};

function focusQueueTitle() {
  document.getElementById(QUEUE_TITLE_ID)?.focus();
}

type ReportDoneHandler = (message: string, isWarning?: boolean) => void;

type ReportActionsProps = { report: Report; viewerId: string; onDone: ReportDoneHandler };

function ReportActions({ report, viewerId, onDone }: ReportActionsProps) {
  const { id, targetType, isContentGone, reportedMember } = report;
  const { deleteLabel } = TARGET_DISPLAY[targetType];
  const body = { reportId: id, targetType };
  const canRemove = reportedMember && !reportedMember.isRemoved && reportedMember.id !== viewerId;

  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDialog
        trigger={
          <Button type="button" variant="outline" className="max-sm:w-full">
            <X aria-hidden="true" />
            Dismiss
          </Button>
        }
        title="Dismiss this report?"
        confirmLabel="Yes, dismiss it"
        pendingLabel="Dismissing…"
        fallbackFocusId={QUEUE_TITLE_ID}
        action={() => dismissReportRequest(body)}
        onDone={({ message }) => onDone(message)}
      >
        <p>Nothing else changes, and nobody is told. If others reported the same thing, those reports close too.</p>
      </ConfirmDialog>
      {deleteLabel && !isContentGone ? (
        <ConfirmDialog
          trigger={
            <Button type="button" variant="outline" className="max-sm:w-full">
              <Trash2 aria-hidden="true" />
              {deleteLabel}
            </Button>
          }
          title={`${deleteLabel}?`}
          confirmLabel="Yes, delete it"
          pendingLabel="Deleting…"
          isDestructive
          fallbackFocusId={QUEUE_TITLE_ID}
          action={() => deleteReportedContentRequest(body)}
          onDone={({ message }) => onDone(message)}
        >
          <p>{DELETION_NOTES[targetType]}</p>
        </ConfirmDialog>
      ) : null}
      {canRemove ? (
        <RemoveMemberDialog
          member={reportedMember}
          trigger={
            <Button type="button" variant="destructive" className="max-sm:w-full">
              <UserRoundX aria-hidden="true" />
              Remove {readFirstName(reportedMember.name)}
            </Button>
          }
          fallbackFocusId={QUEUE_TITLE_ID}
          onDone={onDone}
        />
      ) : null}
    </div>
  );
}

function ResolvedLine({ report }: { report: Report }) {
  const { resolution, resolvedAt, resolvedByName } = report;
  if (!resolution || !resolvedAt) return null;
  return (
    <p className="type-small flex flex-wrap items-center gap-2 text-foreground-soft">
      <ShieldCheck aria-hidden="true" className="size-icon-small shrink-0" />
      {RESOLUTION_LABELS[resolution]} by {resolvedByName} on {formatDateAndTimeUtc(resolvedAt)}.
    </p>
  );
}

function ReportCard({ report, viewerId, onDone }: ReportActionsProps) {
  const { targetType, body, contentCreatedAt, createdAt, reporterName, reportedMemberName, isContentGone, resolution } = report;
  const { label, scope } = TARGET_DISPLAY[targetType];
  const feature = TARGET_FEATURES[targetType];
  const isFeatureOn = useIsModuleEnabled(feature.id);
  return (
    <li className="grid gap-3.5 rounded-card-phone bg-card p-card-phone shadow-panel sm:rounded-card sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="accent">
          <Flag aria-hidden="true" />
          {label}
        </Tag>
        {isContentGone ? <Tag tone="gold">Already deleted</Tag> : null}
        {isFeatureOn ? null : <Tag>{feature.label} is off</Tag>}
        <span className="type-small text-muted-foreground">Reported {formatLongDate(createdAt)}</span>
      </div>
      <dl className="type-small grid gap-1 sm:grid-cols-2">
        <div>
          <dt className="inline font-bold">Written by: </dt>
          <dd className="inline wrap-anywhere text-foreground-soft">
            {reportedMemberName ?? UNKNOWN_PERSON}, {formatLongDate(contentCreatedAt)}
          </dd>
        </div>
        <div>
          <dt className="inline font-bold">Reported by: </dt>
          <dd className="inline wrap-anywhere text-foreground-soft">{reporterName ?? UNKNOWN_PERSON}</dd>
        </div>
      </dl>
      <blockquote className="type-body rounded-field bg-muted p-4 wrap-anywhere whitespace-pre-wrap text-foreground">{body}</blockquote>
      <p className="type-small flex gap-2 text-foreground-soft">
        <Lock aria-hidden="true" className="mt-0.5 size-icon-small shrink-0" />
        {scope}
      </p>
      {resolution ? <ResolvedLine report={report} /> : <ReportActions report={report} viewerId={viewerId} onDone={onDone} />}
    </li>
  );
}

type ReportRowsProps = {
  filter: ReportFilter;
  page: number;
  viewerId: string;
  onDone: ReportDoneHandler;
  onFilterChange: (filter: ReportFilter) => void;
  onPageChange: (page: number) => void;
};

function ReportRows({ filter, page: requestedPage, viewerId, onDone, onFilterChange, onPageChange }: ReportRowsProps) {
  const { data } = useSuspenseQuery(reportPageQuery(filter, requestedPage));
  return (
    <>
      <div role="group" aria-label="Filter reports" className="flex flex-wrap gap-2">
        {FILTER_CHIPS.map(({ filter: chipFilter, label }) => (
          <Chip key={chipFilter} isPressed={filter === chipFilter} onClick={() => onFilterChange(chipFilter)}>
            {label} ({data.counts[chipFilter]})
          </Chip>
        ))}
      </div>
      {data.reports.length === 0 ? (
        <div className="rounded-panel bg-card shadow-panel">
          <EmptyState icon={ShieldCheck} {...EMPTY_STATES[filter]} headingLevel="h3" />
        </div>
      ) : (
        <ul className="grid gap-3">
          {data.reports.map((report) => (
            <ReportCard key={report.id} report={report} viewerId={viewerId} onDone={onDone} />
          ))}
        </ul>
      )}
      <Pagination page={data.page} pageCount={data.pageCount} label="Report pages" onPageChange={onPageChange} />
    </>
  );
}

export function ReportQueue({ viewerId }: { viewerId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState<ReportFilter>(REPORT_FILTERS.open);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<{ message: string; isWarning: boolean } | null>(null);
  const deferredFilter = useDeferredValue(filter);
  const deferredPage = useDeferredValue(page);

  return (
    <section aria-labelledby={QUEUE_TITLE_ID} className="grid gap-3.5">
      <h2 id={QUEUE_TITLE_ID} tabIndex={-1} className="sr-only">
        Report queue
      </h2>
      <div aria-live="polite">
        {notice ? (
          <Alert variant={notice.isWarning ? "info" : "success"} role="none">
            {notice.message}
          </Alert>
        ) : null}
      </div>
      <QueryBoundary loadingMessage="Finding reports…">
        <ReportRows
          filter={deferredFilter}
          page={deferredPage}
          viewerId={viewerId}
          onDone={(message, isWarning = false) => {
            setNotice({ message, isWarning });
            void queryClient.invalidateQueries({ queryKey: [REPORT_QUERY_KEYS.list] });
            router.refresh();
          }}
          onFilterChange={(nextFilter) => {
            setFilter(nextFilter);
            setPage(1);
          }}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            focusQueueTitle();
          }}
        />
      </QueryBoundary>
    </section>
  );
}
