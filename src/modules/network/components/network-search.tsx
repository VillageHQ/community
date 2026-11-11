"use client";

import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronDown, Search, Waypoints } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import type { ConstellationPerson } from "@/components/constellation";
import { EmptyState } from "@/components/empty-state";
import { QueryBoundary } from "@/components/query-boundary";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";
import { LOW_LOOKUPS_LEFT, SEARCH_PROMPT_MAX_LENGTH, SEARCH_PROMPT_PARAM, type NetworkPerson } from "@/modules/network/contract";

import { AskCommunityLink, readSearchAskDraft, useCanAskCommunity } from "./ask-community-link";
import { LeaveGroup } from "./leave-group";
import { LinkedinForm } from "./linkedin-step";
import { NetworkFailure } from "./network-failure";
import { activeSearchQuery, NETWORK_QUERY_KEYS, networkSearchQuery, type ActiveSearch } from "@/modules/network/queries";
import { PersonPaths } from "./person-paths";
import { PersonResult } from "./person-result";
import { SearchWaiting } from "./search-waiting";
import { useIsDesktop } from "./use-is-desktop";
import type { WelcomeContext } from "@/modules/members/components/shared/welcome-context";

const PROMPT_FIELD = "prompt";
const STACKED_FACES = 4;

export function readSearchScope(sharingMemberCount: number, includesOwnNetwork: boolean) {
  if (!includesOwnNetwork) {
    if (sharingMemberCount < 2) return "Search the networks your community's members shared.";
    return `Search the networks ${sharingMemberCount} members shared.`;
  }
  if (sharingMemberCount < 2) return "Search your community's shared networks, including yours.";
  return `Search ${sharingMemberCount} members' networks, including yours.`;
}

export function readPeopleHeading(count: number, includesOwnNetwork: boolean) {
  if (!includesOwnNetwork) return count === 1 ? "1 person members can reach" : `${count} people members can reach`;
  return count === 1 ? "1 person in your network" : `${count} people in your network`;
}

type PathsPanelProps = { person: NetworkPerson; linkedinSlug: string; viewer: ConstellationPerson; panelId: string };

function PathsPanel({ person, linkedinSlug, viewer, panelId }: PathsPanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: false }), [linkedinSlug]);

  return (
    <section
      id={panelId}
      aria-label={`Who can intro you to ${person.fullName}`}
      className="grid gap-4 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-6"
    >
      <h2 ref={heading} tabIndex={-1} className="type-h2 scroll-mt-24 outline-none">
        Who can intro you to {readFirstName(person.fullName)}
      </h2>
      <QueryBoundary
        key={linkedinSlug}
        loadingMessage={`Finding who knows ${readFirstName(person.fullName)}…`}
        failure={NetworkFailure}
      >
        <PersonPaths linkedinSlug={linkedinSlug} personName={person.fullName} personImageUrl={person.imageUrl} viewer={viewer} />
      </QueryBoundary>
    </section>
  );
}

function PickSomeone() {
  return (
    <div className="grid justify-items-center gap-2 rounded-panel bg-muted px-8 py-10 text-center">
      <Waypoints aria-hidden="true" className="size-8 text-brand-emphasis" />
      <p className="type-h3">Pick someone to see the way in</p>
      <p className="type-small text-foreground-soft">We&apos;ll show who knows them, and why.</p>
    </div>
  );
}

function useMarkSearchSeen() {
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClient.setQueryData(activeSearchQuery.queryKey, (active) => (active ? { ...active, wasSeen: true } : active));
  }, [queryClient]);
}

function SearchResults({ prompt, viewer }: { prompt: string; viewer: ConstellationPerson }) {
  const { data: result } = useSuspenseQuery(networkSearchQuery(prompt));
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const isDesktop = useIsDesktop();
  const panelId = useId();
  const selectedPerson = result.people.find(({ linkedinSlug }) => linkedinSlug === selectedSlug);
  useMarkSearchSeen();
  const canAskCommunity = useCanAskCommunity();

  if (result.people.length === 0) {
    return (
      <div role="status" className="rounded-panel bg-card shadow-panel">
        <EmptyState
          icon={Search}
          title={result.includesOwnNetwork ? "Nobody in your network matches" : "Nobody in the shared networks matches"}
          description={
            canAskCommunity
              ? "Try different words, like a role, a company or a city. Or ask the community: someone may know a way in."
              : "Try different words. A role, a company or a city often works."
          }
        >
          {canAskCommunity ? <AskCommunityLink draft={readSearchAskDraft(prompt)} size="lg" /> : null}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_436px] lg:gap-6">
      <section aria-labelledby="results-heading">
        <div role="status">
          <h2 id="results-heading" className="type-h3 mb-3.5">
            {readPeopleHeading(result.people.length, result.includesOwnNetwork)}
          </h2>
        </div>
        <ul aria-label="Search results" className="grid gap-3">
          {result.people.map((person, position) => {
            const isSelected = selectedSlug !== null && person.linkedinSlug === selectedSlug;
            return (
              <li key={person.linkedinSlug ?? `${person.fullName}-${position}`} className="grid gap-3">
                <PersonResult person={person} isSelected={isSelected} panelId={panelId} onSelect={setSelectedSlug} />
                {isSelected && person.linkedinSlug && !isDesktop ? (
                  <PathsPanel person={person} linkedinSlug={person.linkedinSlug} viewer={viewer} panelId={panelId} />
                ) : null}
              </li>
            );
          })}
        </ul>
        {result.dailyLookupsLeft <= LOW_LOOKUPS_LEFT ? (
          <p className="type-small mt-3.5 text-muted-foreground">
            {result.dailyLookupsLeft === 1 ? "1 lookup" : `${result.dailyLookupsLeft} lookups`} left today.
          </p>
        ) : null}
      </section>
      {isDesktop ? (
        <div>
          {selectedPerson?.linkedinSlug ? (
            <PathsPanel person={selectedPerson} linkedinSlug={selectedPerson.linkedinSlug} viewer={viewer} panelId={panelId} />
          ) : (
            <PickSomeone />
          )}
        </div>
      ) : null}
    </div>
  );
}

function FullNameNote() {
  return (
    <p className="type-note flex flex-wrap items-center gap-x-3 gap-y-1 rounded-field bg-card p-4 text-foreground-soft shadow-panel">
      <span className="min-w-0 flex-[1_1_240px]">
        Members see you as a way in when your name here matches your LinkedIn. Add your first and last name, or ask an admin to confirm your LinkedIn.
      </span>
      <Button asChild variant="soft" size="sm">
        <Link href={ROUTES.editCard}>Edit your card</Link>
      </Button>
    </p>
  );
}

function NetworkSettings() {
  const queryClient = useQueryClient();
  return (
    <details className="group rounded-card-phone bg-card shadow-panel sm:rounded-card">
      <summary className="flex min-h-16 list-none items-center justify-between gap-3 rounded-card-phone px-card-phone font-bold sm:rounded-card sm:px-6 [&::-webkit-details-marker]:hidden">
        Your network settings
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid items-start gap-6 px-card-phone pb-[18px] sm:px-6 sm:pb-6 lg:grid-cols-2">
        <div className="grid gap-3">
          <h2 className="type-h3">Change your LinkedIn profile</h2>
          <LinkedinForm
            submitLabel="Save"
            onSaved={() => queryClient.invalidateQueries({ queryKey: [NETWORK_QUERY_KEYS.status] })}
          />
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <h2 className="type-h3">Leave the group</h2>
            <p className="type-small text-foreground-soft">Stops sharing your network. You can still search what others share.</p>
          </div>
          <LeaveGroup />
        </div>
      </div>
    </details>
  );
}

type SearchHeaderProps = {
  welcome: WelcomeContext;
  initialPrompt: string;
  includesOwnNetwork: boolean;
  onSearch: (prompt: string) => void;
};

// A plain page header: the question, whose networks it searches, and the box.
function SearchHeader({ welcome, initialPrompt, includesOwnNetwork, onSearch }: SearchHeaderProps) {
  const [draft, setDraft] = useState(initialPrompt);

  return (
    <section aria-labelledby="network-title" className="grid gap-4">
      <div className="grid gap-2">
        <h1 id="network-title" className="type-h1 max-sm:text-[28px] max-sm:leading-[34px]">
          Who do you want to meet?
        </h1>
        <div className="type-lead flex flex-wrap items-center gap-3 text-foreground-soft">
          {welcome.neighbours.length > 0 ? (
            <span aria-hidden="true" className="inline-flex">
              {welcome.neighbours.slice(0, STACKED_FACES).map(({ id, name, imageUrl }) => (
                <Avatar
                  key={id}
                  stableId={id}
                  name={name}
                  imageUrl={imageUrl}
                  sizePx={28}
                  className="-ml-1.5 shadow-[0_0_0_2px_var(--background)] first:ml-0"
                />
              ))}
            </span>
          ) : null}
          <p>{readSearchScope(welcome.sharingMemberCount, includesOwnNetwork)}</p>
        </div>
      </div>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const prompt = draft.trim();
          if (prompt) onSearch(prompt);
        }}
        className="flex max-w-[760px] flex-wrap items-center gap-2 rounded-card bg-card p-2 pl-4 text-brand-emphasis shadow-[inset_0_0_0_1.5px_var(--input)] focus-within:shadow-[inset_0_0_0_2px_var(--ring)] sm:flex-nowrap sm:gap-3"
      >
        <Search aria-hidden="true" className="size-5 shrink-0" />
        <label htmlFor={PROMPT_FIELD} className="sr-only">
          Describe who you want to meet
        </label>
        <input
          id={PROMPT_FIELD}
          name={PROMPT_FIELD}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          required
          maxLength={SEARCH_PROMPT_MAX_LENGTH}
          placeholder="Fintech founders in London"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[17px] leading-6 text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" className="max-sm:w-full">
          Search
        </Button>
      </form>
    </section>
  );
}

function toActiveSearch(prompt: string): ActiveSearch {
  return { prompt, startedAtMs: Date.now(), wasSeen: false };
}

// Today's search box arrives with its words in the address: search them once, then drop them from the address so a
// reload doesn't spend another lookup.
function useSearchFromAddress(startSearch: (prompt: string) => void) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get(SEARCH_PROMPT_PARAM);
  const prompt = raw?.trim().slice(0, SEARCH_PROMPT_MAX_LENGTH) ?? "";
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (raw === null || handled.current === raw) return;
    handled.current = raw;
    if (prompt) startSearch(prompt);
    router.replace(ROUTES.network, { scroll: false });
  }, [raw, prompt, router, startSearch]);
}

// Before a member connects, `invitation` is the invitation to add their network: the search then covers only the
// networks others shared, and the member has no network settings yet.
export function NetworkSearch({ welcome, invitation }: { welcome: WelcomeContext; invitation?: ReactNode }) {
  const includesOwnNetwork = invitation === undefined;
  const queryClient = useQueryClient();
  const { data: active } = useQuery(activeSearchQuery);
  const startSearch = useCallback(
    (prompt: string) => queryClient.setQueryData(activeSearchQuery.queryKey, toActiveSearch(prompt)),
    [queryClient],
  );
  useSearchFromAddress(startSearch);

  return (
    <div className="grid gap-6">
      <SearchHeader
        key={active?.startedAtMs ?? "new"}
        welcome={welcome}
        initialPrompt={active?.prompt ?? ""}
        includesOwnNetwork={includesOwnNetwork}
        onSearch={startSearch}
      />
      {invitation}
      {active ? (
        <QueryBoundary
          key={`${active.prompt}-${active.startedAtMs}`}
          loadingMessage={includesOwnNetwork ? "Searching your network…" : "Searching the community's networks…"}
          failure={NetworkFailure}
          fallback={
            <SearchWaiting
              prompt={active.prompt}
              startedAtMs={active.startedAtMs}
              person={welcome.member}
              sharingMemberCount={welcome.sharingMemberCount}
            />
          }
        >
          <SearchResults prompt={active.prompt} viewer={welcome.member} />
        </QueryBoundary>
      ) : null}
      {welcome.needsFullName && includesOwnNetwork ? <FullNameNote /> : null}
      {includesOwnNetwork ? <NetworkSettings /> : null}
    </div>
  );
}
