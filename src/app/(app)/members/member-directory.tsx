"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Search, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { QueryBoundary } from "@/components/query-boundary";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import { parseDirectoryFilters, toDirectoryQueryString } from "@/lib/members/directory-url";
import { PROFILE_LIMITS, type DirectoryFilters, type DirectoryMember } from "@/lib/members/profile-api";
import { ROUTES } from "@/lib/routes";

import { directoryQuery } from "./member-queries";

const SEARCH_DEBOUNCE_MS = 250;
const MEMBER_AVATAR_SIZE_PX = 72;
const RESULTS_ID = "member-results";
const SEARCH_INPUT_ID = "member-search";
const EVERYONE_TAG = "";

let pendingSearch: ReturnType<typeof setTimeout> | undefined;

function applyFilters(filters: DirectoryFilters) {
  window.history.replaceState(null, "", `${ROUTES.members}${toDirectoryQueryString(filters)}`);
}

function scheduleSearch(search: string, filters: DirectoryFilters) {
  clearTimeout(pendingSearch);
  pendingSearch = setTimeout(() => {
    if (window.location.pathname === ROUTES.members) applyFilters({ ...filters, search, page: 1 });
  }, SEARCH_DEBOUNCE_MS);
}

function clearFilters(setSearchDraft: (search: string) => void) {
  clearTimeout(pendingSearch);
  setSearchDraft("");
  applyFilters({ search: "", tag: EVERYONE_TAG, page: 1 });
  document.getElementById(SEARCH_INPUT_ID)?.focus();
}

function goToPage(page: number, filters: DirectoryFilters) {
  applyFilters({ ...filters, page });
  document.getElementById(RESULTS_ID)?.focus();
}

function MemberCard({ member }: { member: DirectoryMember }) {
  const { id, name, title, company, canHelpWith, avatarUrl, tags } = member;
  return (
    <li className="flex">
      <article className="flex w-full flex-col rounded-card-phone bg-card p-card-phone shadow-panel sm:rounded-card sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar stableId={id} name={name} imageUrl={avatarUrl} sizePx={MEMBER_AVATAR_SIZE_PX} />
          <div className="min-w-0">
            <h2 className="text-lg leading-6 font-bold tracking-[-0.006em]">{name}</h2>
            {title ? <div className="type-small text-muted-foreground">{title}</div> : null}
            {company ? <div className="type-small text-muted-foreground">{company}</div> : null}
          </div>
        </div>
        {canHelpWith ? (
          <p className="mt-4 type-note text-foreground-soft">
            <b className="type-micro block font-bold text-muted-foreground">Ask me about</b>
            {canHelpWith}
          </p>
        ) : (
          <p className="mt-4 type-note text-muted-foreground">Still settling in.</p>
        )}
        <div className="mt-3.5 mb-[18px] flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
        <Button asChild className="mt-auto w-full">
          <Link href={`${ROUTES.members}/${id}`} aria-label={`View profile of ${name}`}>
            View profile
          </Link>
        </Button>
      </article>
    </li>
  );
}

function readMatchSentence(matchCount: number) {
  return matchCount === 1 ? "1 member matches." : `${matchCount} members match.`;
}

function DirectoryEmpty({ filters, onClear }: { filters: DirectoryFilters; onClear: () => void }) {
  const isFiltered = Boolean(filters.search || filters.tag);
  if (!isFiltered) {
    return (
      <div className="rounded-panel bg-card shadow-panel">
        <EmptyState
          icon={UsersRound}
          title="It's just you for now"
          description="As people accept their invites, they'll show up here."
        />
      </div>
    );
  }
  return (
    <div className="rounded-panel bg-card shadow-panel">
      <EmptyState
        title="Nobody matches that yet"
        description="Try a different name, company or tag. Fewer words usually help."
      >
        <Button type="button" size="lg" onClick={onClear}>
          Show everyone
        </Button>
      </EmptyState>
    </div>
  );
}

type DirectoryResultsProps = { filters: DirectoryFilters; onClear: () => void; isStale: boolean };

function DirectoryResults({ filters, onClear, isStale }: DirectoryResultsProps) {
  const { data: directory } = useSuspenseQuery(directoryQuery(filters));
  const { members, matchCount, page, pageCount, popularTags } = directory;
  const isFiltered = Boolean(filters.search || filters.tag);
  return (
    <>
      {popularTags.length > 0 ? (
        <div role="group" aria-label="Filter members" className="mb-6 flex flex-wrap gap-2">
          <Chip
            isPressed={filters.tag === EVERYONE_TAG}
            onClick={() => applyFilters({ ...filters, tag: EVERYONE_TAG, page: 1 })}
          >
            Everyone
          </Chip>
          {popularTags.map(({ label, value }) => (
            <Chip
              key={value}
              isPressed={filters.tag.toLowerCase() === value}
              onClick={() => applyFilters({ ...filters, tag: value, page: 1 })}
            >
              {label}
            </Chip>
          ))}
        </div>
      ) : null}
      <div id={RESULTS_ID} tabIndex={-1} aria-busy={isStale} className={cn("outline-none", isStale && "opacity-60")}>
        <p role="status" className={cn("type-small mb-3.5 font-semibold text-foreground-soft", !isFiltered && "sr-only")}>
          {readMatchSentence(matchCount)}
        </p>
        {members.length === 0 ? (
          <DirectoryEmpty filters={filters} onClear={onClear} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
            {members.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </ul>
        )}
      </div>
      <Pagination
        page={page}
        pageCount={pageCount}
        label="Member pages"
        onPageChange={(nextPage) => goToPage(nextPage, filters)}
      />
    </>
  );
}

export function MemberDirectory() {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const deferredQueryString = useDeferredValue(queryString);
  const filters = parseDirectoryFilters(Object.fromEntries(searchParams));
  const deferredFilters = parseDirectoryFilters(Object.fromEntries(new URLSearchParams(deferredQueryString)));
  const [searchDraft, setSearchDraft] = useState(filters.search);

  return (
    <>
      <div role="search" className="relative mb-3.5">
        <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
          Search members
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-5 size-icon -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={SEARCH_INPUT_ID}
          type="search"
          value={searchDraft}
          maxLength={PROFILE_LIMITS.search}
          placeholder="Search by name, company or tag"
          autoComplete="off"
          className="pr-14 pl-[54px] [&::-webkit-search-cancel-button]:hidden"
          onChange={(event) => {
            setSearchDraft(event.target.value);
            scheduleSearch(event.target.value, filters);
          }}
        />
        {searchDraft ? (
          <Button
            type="button"
            variant="quiet"
            size="icon"
            aria-label="Clear search"
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
            onClick={() => clearFilters(setSearchDraft)}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <QueryBoundary loadingMessage="Gathering everyone…">
        <DirectoryResults
          filters={deferredFilters}
          onClear={() => clearFilters(setSearchDraft)}
          isStale={queryString !== deferredQueryString}
        />
      </QueryBoundary>
    </>
  );
}
