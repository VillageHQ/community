"use client";

import { useMutation, useQueryClient, useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { CircleAlert, MailCheck, MailPlus } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState, type ComponentProps } from "react";

import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { Pagination } from "@/components/pagination";
import { QueryBoundary } from "@/components/query-boundary";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Tag } from "@/components/ui/tag";
import { formatShortDate } from "@/platform/text/format-date";
import { INVITE_FILTERS, type InviteFilter, type InviteList as InviteListData, type InviteSummary, type IssuedInvite } from "@/lib/invites/invite-api";
import { INVITE_EMAIL_STATUSES, INVITE_STATES, type InviteState } from "@/lib/invites/invite-state";
import { ROUTES } from "@/platform/http/routes";

import {
  INVITE_QUERY_KEYS,
  inviteListQuery,
  resendInviteRequest,
  revokeInviteRequest,
} from "./invite-queries";
import { IssuedLink } from "./issued-link";
import { ReclaimAction } from "./reclaim-action";

const INVITE_AVATAR_SIZE_PX = 44;
const INVITES_TITLE_ID = "invites-title";

const STATE_TAGS: Record<InviteState, { label: string; tone: ComponentProps<typeof Tag>["tone"] }> = {
  [INVITE_STATES.pending]: { label: "Pending", tone: "accent" },
  [INVITE_STATES.accepted]: { label: "Accepted", tone: "sage" },
  [INVITE_STATES.expired]: { label: "Expired", tone: "gold" },
  [INVITE_STATES.revoked]: { label: "Revoked", tone: "neutral" },
};

const STATE_DETAILS: Record<InviteState, (invite: InviteSummary) => string> = {
  [INVITE_STATES.pending]: ({ invitedByName, expiresAt }) =>
    `Invited by ${invitedByName}. Expires ${formatShortDate(expiresAt)}.`,
  [INVITE_STATES.accepted]: ({ invitedByName, acceptedAt }) =>
    `Invited by ${invitedByName}. Joined ${formatShortDate(acceptedAt ?? "")}.`,
  [INVITE_STATES.expired]: ({ invitedByName, expiresAt }) =>
    `Invited by ${invitedByName}. Expired ${formatShortDate(expiresAt)}.`,
  [INVITE_STATES.revoked]: ({ invitedByName, revokedAt }) =>
    `Invited by ${invitedByName}. Revoked ${formatShortDate(revokedAt ?? "")}.`,
};

const FILTER_CHIPS: { filter: InviteFilter; label: string }[] = [
  { filter: INVITE_FILTERS.all, label: "All" },
  { filter: INVITE_FILTERS.pending, label: "Pending" },
  { filter: INVITE_FILTERS.accepted, label: "Accepted" },
  { filter: INVITE_FILTERS.expired, label: "Expired" },
  { filter: INVITE_FILTERS.revoked, label: "Revoked" },
];

const RENEWABLE_STATES: ReadonlySet<InviteState> = new Set([INVITE_STATES.pending, INVITE_STATES.expired]);

function focusInvitesTitle() {
  document.getElementById(INVITES_TITLE_ID)?.focus();
}

function refreshInviteList(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: [INVITE_QUERY_KEYS.list] });
}

type InviteRowProps = {
  invite: InviteSummary;
  isEmailConfigured: boolean;
  issued: IssuedInvite | null;
  onIssued: (issued: IssuedInvite) => void;
};

function InviteRow({ invite, isEmailConfigured, issued, onIssued }: InviteRowProps) {
  const queryClient = useQueryClient();
  const resendMutation = useMutation({
    mutationFn: resendInviteRequest,
    onSuccess: (issued) => {
      onIssued(issued);
      return refreshInviteList(queryClient);
    },
  });
  const revokeMutation = useMutation({ mutationFn: revokeInviteRequest, onSuccess: () => refreshInviteList(queryClient) });
  const { id, email, state, emailStatus, acceptedUserId } = invite;
  const { label, tone } = STATE_TAGS[state];
  const isBusy = resendMutation.isPending || revokeMutation.isPending;

  return (
    <li className="grid gap-3 rounded-card-phone bg-card p-4 shadow-panel sm:rounded-card sm:px-5 sm:py-3.5">
      <div className="flex min-h-13 flex-wrap items-center gap-x-4 gap-y-3">
        <Avatar stableId={id} name={email} sizePx={INVITE_AVATAR_SIZE_PX} />
        <div className="min-w-0 flex-[1_1_220px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-label wrap-anywhere">{email}</span>
            <Tag tone={tone}>{label}</Tag>
            {state === INVITE_STATES.pending && emailStatus === INVITE_EMAIL_STATUSES.sent ? (
              <Tag>
                <MailCheck aria-hidden="true" />
                Emailed
              </Tag>
            ) : null}
            {state === INVITE_STATES.pending && emailStatus === INVITE_EMAIL_STATUSES.failed ? (
              <Tag tone="destructive">
                <CircleAlert aria-hidden="true" />
                Email failed
              </Tag>
            ) : null}
          </div>
          <p className="type-small mt-0.5 text-muted-foreground">{STATE_DETAILS[state](invite)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          {RENEWABLE_STATES.has(state) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => resendMutation.mutate(id)}
            >
              {resendMutation.isPending ? "Working…" : isEmailConfigured ? "Resend" : "New link"}
              <span className="sr-only"> for {email}</span>
            </Button>
          ) : null}
          {state === INVITE_STATES.pending ? (
            <Button
              type="button"
              variant="quiet"
              size="sm"
              disabled={isBusy}
              onClick={() => revokeMutation.mutate(id)}
            >
              {revokeMutation.isPending ? "Revoking…" : "Revoke"}
              <span className="sr-only"> invite for {email}</span>
            </Button>
          ) : null}
          {state === INVITE_STATES.accepted && acceptedUserId ? (
            <Button asChild variant="soft" size="sm">
              <Link href={`${ROUTES.members}/${acceptedUserId}`} aria-label={`View profile of ${email}`}>
                View profile
              </Link>
            </Button>
          ) : null}
          {state === INVITE_STATES.accepted ? (
            <ReclaimAction inviteId={id} email={email} fallbackFocusId={INVITES_TITLE_ID} />
          ) : null}
        </div>
      </div>
      <FormError message={resendMutation.error?.message ?? revokeMutation.error?.message ?? null} />
      {issued?.invite.id === id && state === INVITE_STATES.pending ? <IssuedLink issued={issued} /> : null}
    </li>
  );
}

type InviteRowsProps = {
  page: number;
  filter: InviteFilter;
  isEmailConfigured: boolean;
  issued: IssuedInvite | null;
  onIssued: (issued: IssuedInvite) => void;
  onPageChange: (page: number) => void;
  onFilterChange: (filter: InviteFilter) => void;
};

function InviteFilters({ data, filter, onFilterChange }: { data: InviteListData; filter: InviteFilter; onFilterChange: (filter: InviteFilter) => void }) {
  return (
    <div role="group" aria-label="Filter invites" className="flex flex-wrap gap-2">
      {FILTER_CHIPS.map(({ filter: chipFilter, label }) => (
        <Chip key={chipFilter} isPressed={filter === chipFilter} onClick={() => onFilterChange(chipFilter)}>
          {label} ({data.counts[chipFilter]})
        </Chip>
      ))}
    </div>
  );
}

function InviteRows({ page: requestedPage, filter, isEmailConfigured, issued, onIssued, onPageChange, onFilterChange }: InviteRowsProps) {
  const { data } = useSuspenseQuery(inviteListQuery(requestedPage, filter));
  if (data.counts.all === 0) {
    return (
      <div className="rounded-panel bg-card shadow-panel">
        <EmptyState
          icon={MailPlus}
          title="No invites yet"
          description="Create your first one above. It's a personal link for one person."
        />
      </div>
    );
  }
  return (
    <>
      <InviteFilters data={data} filter={filter} onFilterChange={onFilterChange} />
      {data.invites.length === 0 ? (
        <p className="type-small rounded-field bg-muted px-4 py-3.5 text-foreground-soft">Nothing here right now.</p>
      ) : (
        <ul className="grid gap-2.5">
          {data.invites.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              isEmailConfigured={isEmailConfigured}
              issued={issued}
              onIssued={onIssued}
            />
          ))}
        </ul>
      )}
      <Pagination page={data.page} pageCount={data.pageCount} label="Invite pages" onPageChange={onPageChange} />
    </>
  );
}

type InviteListProps = {
  isEmailConfigured: boolean;
  issued: IssuedInvite | null;
  onIssued: (issued: IssuedInvite) => void;
};

export function InviteList({ isEmailConfigured, issued, onIssued }: InviteListProps) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<InviteFilter>(INVITE_FILTERS.all);
  const deferredPage = useDeferredValue(page);
  const deferredFilter = useDeferredValue(filter);

  return (
    <section aria-labelledby={INVITES_TITLE_ID} className="grid gap-3.5">
      <h2 id={INVITES_TITLE_ID} tabIndex={-1} className="type-h2 outline-none">
        Invites
      </h2>
      <QueryBoundary loadingMessage="Finding your invites…">
        <InviteRows
          page={deferredPage}
          filter={deferredFilter}
          isEmailConfigured={isEmailConfigured}
          issued={issued}
          onIssued={onIssued}
          onFilterChange={(nextFilter) => {
            setFilter(nextFilter);
            setPage(1);
          }}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            focusInvitesTitle();
          }}
        />
      </QueryBoundary>
    </section>
  );
}
