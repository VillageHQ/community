"use client";

import { useQueryClient, useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { ChevronDown, Search, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useId, useRef, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { QueryBoundary } from "@/components/query-boundary";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag } from "@/components/ui/tag";
import {
  GROUP_DEPARTURE_OUTCOMES,
  MAXIMUM_SEARCH_LENGTH,
  MEMBER_FILTERS,
  type AdminMember,
  type GroupDepartureOutcome,
  type MemberFilter,
} from "@/lib/admin/admin-api";
import { readFirstName } from "@/platform/design/avatar-identity";
import { formatLongDate } from "@/platform/text/format-date";

import { useDebouncedValue } from "@/app/(app)/messages/use-debounced-value";
import { INVITE_QUERY_KEYS } from "@/modules/members/queries-invites";
import { MemberActions, VILLAGE_STATUS_DETAILS } from "./member-actions";
import { ADMIN_MEMBER_QUERY_KEYS, memberPageQuery } from "./member-queries";

const SEARCH_DEBOUNCE_MS = 300;
const MEMBER_AVATAR_SIZE_PX = 52;
const MEMBERS_TITLE_ID = "members-title";

const FILTER_CHIPS: { filter: MemberFilter; label: string }[] = [
  { filter: MEMBER_FILTERS.all, label: "Everyone" },
  { filter: MEMBER_FILTERS.admins, label: "Admins" },
  { filter: MEMBER_FILTERS.attention, label: "Needs a look" },
  { filter: MEMBER_FILTERS.removed, label: "Removed" },
];

function focusMembersTitle() {
  document.getElementById(MEMBERS_TITLE_ID)?.focus();
}

function refreshAfterMemberChange(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [ADMIN_MEMBER_QUERY_KEYS.list] }),
    queryClient.invalidateQueries({ queryKey: [INVITE_QUERY_KEYS.waiting] }),
    queryClient.invalidateQueries({ queryKey: [INVITE_QUERY_KEYS.list] }),
  ]);
}

const REMOVED_GROUP_NOTES: Record<GroupDepartureOutcome, (firstName: string) => string> = {
  [GROUP_DEPARTURE_OUTCOMES.left]: (firstName) => `Village took ${firstName} out of the group. Anyone who already saw results through them can't unsee those.`,
  [GROUP_DEPARTURE_OUTCOMES.creatorRefused]: (firstName) =>
    `${firstName} is still in the Village group. Village refused to take them out, because they created it and other members remain. Their network stays shared until everyone else leaves.`,
  [GROUP_DEPARTURE_OUTCOMES.failed]: (firstName) =>
    `${firstName} is still in the Village group, as far as this site knows. We couldn't take them out, so their network stays shared through Village. Try again, or they can leave inside Village. Here, they count as outside the community.`,
};

function RemovedNote({ member }: { member: AdminMember }) {
  const { isRemoved, isInVillageGroup, hasStaleVillageMembership, villageLeaveOutcome, name } = member;
  if (!isRemoved) return null;
  const outcome = villageLeaveOutcome ?? (isInVillageGroup || hasStaleVillageMembership ? GROUP_DEPARTURE_OUTCOMES.failed : null);
  if (!outcome) return null;
  return (
    <div className={`type-small flex gap-2.5 rounded-field p-3.5 ${outcome === GROUP_DEPARTURE_OUTCOMES.left ? "bg-sage-soft text-sage-text" : "bg-gold-soft text-gold-text"}`}>
      <ShieldAlert aria-hidden="true" className="mt-0.5 size-icon-small shrink-0" />
      <p>{REMOVED_GROUP_NOTES[outcome](readFirstName(name))}</p>
    </div>
  );
}

function MemberTags({ member, isViewer }: { member: AdminMember; isViewer: boolean }) {
  const village = VILLAGE_STATUS_DETAILS[member.villageStatus];
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {isViewer ? <Tag tone="accent">You</Tag> : null}
      {member.isAdmin ? (
        <Tag tone="accent">
          <ShieldCheck aria-hidden="true" />
          Admin
        </Tag>
      ) : (
        <Tag>Member</Tag>
      )}
      {member.isRemoved ? <Tag tone="destructive">Removed</Tag> : null}
      <Tag tone={member.isEmailConfirmed ? "sage" : "gold"}>{member.isEmailConfirmed ? "Email confirmed" : "Email not confirmed"}</Tag>
      <Tag tone={village.tone}>Village: {village.label}</Tag>
    </div>
  );
}

type MemberDoneHandler = (message: string, isWarning?: boolean) => void;

function MemberRow({ member, viewerId, onDone }: { member: AdminMember; viewerId: string; onDone: MemberDoneHandler }) {
  const [isOpen, setIsOpen] = useState(false);
  const manageButtonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { id, name, email, avatarUrl, joinedAt } = member;

  return (
    <li className="grid gap-3 rounded-card-phone bg-card p-4 shadow-panel sm:rounded-card sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Avatar stableId={id} name={name} imageUrl={avatarUrl} sizePx={MEMBER_AVATAR_SIZE_PX} />
        <div className="min-w-0 flex-[1_1_240px]">
          <div className="type-label wrap-anywhere">{name}</div>
          <div className="type-small wrap-anywhere text-muted-foreground">
            {email ?? "No email"} · Joined {formatLongDate(joinedAt)}
          </div>
          <MemberTags member={member} isViewer={id === viewerId} />
        </div>
        <Button
          ref={manageButtonRef}
          type="button"
          variant="outline"
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="max-sm:w-full"
          onClick={() => setIsOpen(!isOpen)}
        >
          Manage
          <span className="sr-only"> {name}</span>
          <ChevronDown aria-hidden="true" className={isOpen ? "rotate-180 transition-transform" : "transition-transform"} />
        </Button>
      </div>
      <RemovedNote member={member} />
      <div id={panelId} hidden={!isOpen}>
        {isOpen ? (
          <MemberActions member={member} viewerId={viewerId} manageButtonRef={manageButtonRef} fallbackFocusId={MEMBERS_TITLE_ID} onDone={onDone} />
        ) : null}
      </div>
    </li>
  );
}

type MemberRowsProps = {
  search: string;
  filter: MemberFilter;
  page: number;
  viewerId: string;
  onDone: MemberDoneHandler;
  onFilterChange: (filter: MemberFilter) => void;
  onPageChange: (page: number) => void;
};

function MemberRows({ search, filter, page: requestedPage, viewerId, onDone, onFilterChange, onPageChange }: MemberRowsProps) {
  const { data } = useSuspenseQuery(memberPageQuery({ search, filter, page: requestedPage }));
  return (
    <>
      <div role="group" aria-label="Filter members" className="flex flex-wrap gap-2">
        {FILTER_CHIPS.map(({ filter: chipFilter, label }) => (
          <Chip key={chipFilter} isPressed={filter === chipFilter} onClick={() => onFilterChange(chipFilter)}>
            {label} ({data.counts[chipFilter]})
          </Chip>
        ))}
      </div>
      <p role="status" className="sr-only">
        {data.matchCount === 1 ? "1 member found." : `${data.matchCount} members found.`}
      </p>
      {data.members.length === 0 ? (
        <div className="rounded-panel bg-card shadow-panel">
          <EmptyState icon={Users} title="Nobody matches that" description="Try another name or email, or clear the filter." headingLevel="h3" />
        </div>
      ) : (
        <ul className="grid gap-2.5">
          {data.members.map((member) => (
            <MemberRow key={member.id} member={member} viewerId={viewerId} onDone={onDone} />
          ))}
        </ul>
      )}
      <Pagination page={data.page} pageCount={data.pageCount} label="Member pages" onPageChange={onPageChange} />
    </>
  );
}

export function MemberManager({ viewerId, initialSearch }: { viewerId: string; initialSearch: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchId = useId();
  const [searchText, setSearchText] = useState(initialSearch);
  const [filter, setFilter] = useState<MemberFilter>(MEMBER_FILTERS.all);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<{ message: string; isWarning: boolean } | null>(null);
  const debouncedSearch = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const deferredSearch = useDeferredValue(debouncedSearch);
  const deferredFilter = useDeferredValue(filter);
  const deferredPage = useDeferredValue(page);

  return (
    <section aria-labelledby={MEMBERS_TITLE_ID} className="grid gap-3.5">
      <h2 id={MEMBERS_TITLE_ID} tabIndex={-1} className="type-h2 outline-none">
        Everyone here
      </h2>
      <div className="grid gap-2">
        <Label htmlFor={searchId}>Find someone by name, email or LinkedIn</Label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchId}
            type="search"
            autoComplete="off"
            maxLength={MAXIMUM_SEARCH_LENGTH}
            className="pl-13"
            placeholder="Start typing a name"
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      <div aria-live="polite">
        {notice ? (
          <Alert variant={notice.isWarning ? "info" : "success"} role="none">
            {notice.message}
          </Alert>
        ) : null}
      </div>
      <QueryBoundary loadingMessage="Finding your members…">
        <MemberRows
          search={deferredSearch}
          filter={deferredFilter}
          page={deferredPage}
          viewerId={viewerId}
          onDone={(message, isWarning = false) => {
            setNotice({ message, isWarning });
            void refreshAfterMemberChange(queryClient);
            router.refresh();
          }}
          onFilterChange={(nextFilter) => {
            setFilter(nextFilter);
            setPage(1);
          }}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            focusMembersTitle();
          }}
        />
      </QueryBoundary>
    </section>
  );
}
