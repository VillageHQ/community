"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Flag, Lock, Trash2, UserRoundX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { FLASH_KINDS, FlashNote } from "@/components/flash";
import { Pagination } from "@/components/pagination";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { SegmentedControl } from "@/components/ui/segmented";
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

// Set up › Reports, in Founderhall's parts: one sheet, the Open | Handled segmented control in its head, and one
// moderation row per report (as Asks & digest's "Every ask and update"), its state as pills and its actions as small
// quiet buttons at the row's end.
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

const FILTERS: { filter: ReportFilter; label: string }[] = [
  { filter: REPORT_FILTERS.open, label: "Open" },
  { filter: REPORT_FILTERS.resolved, label: "Handled" },
];

const FILTER_TITLES: Record<ReportFilter, string> = { [REPORT_FILTERS.open]: "Waiting for you", [REPORT_FILTERS.resolved]: "Handled" };

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
    <span className="fh-modacts flex flex-wrap justify-end gap-1">
      <ConfirmDialog
        trigger={
          <Button type="button" variant="quiet" size="sm">
            <X aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
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
            <Button type="button" variant="quiet" size="sm">
              <Trash2 aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
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
            <Button type="button" variant="quiet" size="sm" className="text-ribbon">
              <UserRoundX aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
              Remove {readFirstName(reportedMember.name)}
            </Button>
          }
          fallbackFocusId={QUEUE_TITLE_ID}
          onDone={onDone}
        />
      ) : null}
    </span>
  );
}

function ResolvedLine({ report }: { report: Report }) {
  const { resolution, resolvedAt, resolvedByName } = report;
  if (!resolution || !resolvedAt) return null;
  return (
    <span className="whitespace-normal">
      {RESOLUTION_LABELS[resolution]} by {resolvedByName} on {formatDateAndTimeUtc(resolvedAt)}.
    </span>
  );
}

// What was written (the copy kept when it was reported), who wrote it and who reported it, and what an admin can see.
function ReportRow({ report, viewerId, onDone }: ReportActionsProps) {
  const { targetType, body, contentCreatedAt, createdAt, reporterName, reportedMemberName, isContentGone, resolution } = report;
  const { label, scope } = TARGET_DISPLAY[targetType];
  const feature = TARGET_FEATURES[targetType];
  const isFeatureOn = useIsModuleEnabled(feature.id);
  return (
    <li className="fh-r">
      <span>
        <Flag aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
      </span>
      <div className="fh-who">
        <b className="fh-plain wrap-anywhere whitespace-pre-wrap">{body}</b>
        <span className="whitespace-normal">
          {label} by <span className="inline">{reportedMemberName ?? UNKNOWN_PERSON}</span>, {formatLongDate(contentCreatedAt)} · Reported by{" "}
          <span className="inline">{reporterName ?? UNKNOWN_PERSON}</span>, {formatLongDate(createdAt)}
        </span>
        <span className="whitespace-normal">
          <Lock aria-hidden="true" className="fh-i fh-xs mr-1 inline align-[-2px]" strokeWidth={1.5} />
          {scope}
        </span>
        {resolution ? <ResolvedLine report={report} /> : null}
      </div>
      <div className="fh-end">
        <span className="flex flex-wrap justify-end gap-1.5">
          {resolution ? (
            <Pill tone={resolution === REPORT_RESOLUTIONS.dismissed ? "plain" : "declined"}>{RESOLUTION_LABELS[resolution]}</Pill>
          ) : (
            <Pill tone="open">Open</Pill>
          )}
          {isContentGone ? <Pill tone="needs">Already deleted</Pill> : null}
          {isFeatureOn ? null : <Pill tone="plain">{feature.label} is off</Pill>}
        </span>
        {resolution ? null : <ReportActions report={report} viewerId={viewerId} onDone={onDone} />}
      </div>
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
      <div className="fh-sheet-head mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id={QUEUE_TITLE_ID} tabIndex={-1} className="type-h3">
          {FILTER_TITLES[filter]}
        </h2>
        <SegmentedControl
          label="Filter reports"
          segments={FILTERS.map(({ filter: value, label }) => ({ value, label: `${label} (${data.counts[value]})` }))}
          value={filter}
          onChange={onFilterChange}
        />
      </div>
      {data.reports.length === 0 ? (
        <EmptyState {...EMPTY_STATES[filter]} headingLevel="h3" />
      ) : (
        <ul aria-labelledby={QUEUE_TITLE_ID} className="fh-rows fh-modrows">
          {data.reports.map((report) => (
            <ReportRow key={report.id} report={report} viewerId={viewerId} onDone={onDone} />
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
    <section aria-label="Report queue" className="grid gap-3.5">
      <div aria-live="polite">{notice ? <FlashNote kind={notice.isWarning ? FLASH_KINDS.needs : FLASH_KINDS.ok}>{notice.message}</FlashNote> : null}</div>
      <Card className="fh-sheet">
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
        <p className="fh-small fh-muted mt-2.5">
          Dismiss closes a report and changes nothing else. Delete removes it for everyone; a copy stays in the audit log. Nobody is told who reported.
        </p>
      </Card>
    </section>
  );
}
