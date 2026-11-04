"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Search, Waypoints } from "lucide-react";
import { useState } from "react";

import { CommunityMemberBadge } from "@/components/community-member-badge";
import type { ConstellationPerson } from "@/components/constellation";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { QueryBoundary } from "@/components/query-boundary";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { readFirstName } from "@/lib/design/avatar-identity";
import { toLinkedinUrl } from "@/lib/village/linkedin-slug";
import type { NetworkPerson } from "@/lib/village/network-api";

import { LeaveGroup } from "./leave-group";
import { LinkedinForm } from "./linkedin-step";
import { NETWORK_QUERY_KEYS, networkSearchQuery } from "./network-queries";
import { PersonPaths } from "./person-paths";
import type { WelcomeContext } from "./welcome-context";

const PROMPT_FIELD = "prompt";
const SEARCH_EXAMPLES = ["Fintech founders in London", "Angels who back climate", "Heads of sales at SaaS companies"];
const SEARCH_DURATION_NOTE = "Searches can take a minute or more.";
const STACKED_FACES = 4;

function readSearchScope(sharingMemberCount: number) {
  if (sharingMemberCount < 2) return "Search your community's shared networks, including yours.";
  return `Search ${sharingMemberCount} members' networks, including yours.`;
}

type PathsPanelProps = { person: NetworkPerson; linkedinSlug: string; viewer: ConstellationPerson };

function PathsPanel({ person, linkedinSlug, viewer }: PathsPanelProps) {
  return (
    <section aria-label={`Intro paths to ${person.fullName}`} className="grid gap-4 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-6">
      <h2 className="type-h2">Who can intro you to {readFirstName(person.fullName)}</h2>
      <QueryBoundary loadingMessage="Finding intro paths…">
        <PersonPaths linkedinSlug={linkedinSlug} personName={person.fullName} viewer={viewer} />
      </QueryBoundary>
    </section>
  );
}

type PersonResultProps = {
  person: NetworkPerson;
  isSelected: boolean;
  viewer: ConstellationPerson;
  onSelect: (linkedinSlug: string | null) => void;
};

function PersonResult({ person, isSelected, viewer, onSelect }: PersonResultProps) {
  const { fullName, headline, linkedinSlug, isMember } = person;

  return (
    <li className="grid gap-3">
      <div
        data-selected={isSelected}
        className="flex flex-wrap items-center gap-3.5 rounded-card bg-card px-card-phone py-4 shadow-panel data-[selected=true]:shadow-[inset_0_0_0_2.5px_var(--brand-emphasis),var(--elevation-panel)]"
      >
        <Avatar stableId={linkedinSlug ?? fullName} name={fullName} sizePx={56} />
        <div className="min-w-0 flex-[1_1_180px]">
          {linkedinSlug ? (
            <a
              className="inline-flex items-center gap-1.5 text-base leading-[22px] font-bold underline-offset-3 hover:underline"
              href={toLinkedinUrl(linkedinSlug)}
              rel="noreferrer"
              target="_blank"
            >
              <span className="min-w-0 wrap-anywhere">{fullName}</span>
              <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="sr-only">on LinkedIn, opens in a new tab</span>
            </a>
          ) : (
            <span className="text-base leading-[22px] font-bold wrap-anywhere">{fullName}</span>
          )}
          {headline ? <p className="type-small wrap-anywhere text-foreground-soft">{headline}</p> : null}
          {isMember ? (
            <div className="mt-1.5">
              <CommunityMemberBadge />
            </div>
          ) : null}
        </div>
        {linkedinSlug ? (
          <Button
            type="button"
            size="sm"
            variant={isSelected ? "outline" : "soft"}
            aria-expanded={isSelected}
            className="ml-auto"
            onClick={() => onSelect(isSelected ? null : linkedinSlug)}
          >
            {isSelected ? "Hide intro paths" : "Show intro paths"}
          </Button>
        ) : null}
      </div>
      {isSelected && linkedinSlug ? (
        <div className="lg:hidden">
          <PathsPanel person={person} linkedinSlug={linkedinSlug} viewer={viewer} />
        </div>
      ) : null}
    </li>
  );
}

function readPeopleHeading(count: number) {
  return count === 1 ? "1 person in your network" : `${count} people in your network`;
}

function SearchResults({ prompt, viewer }: { prompt: string; viewer: ConstellationPerson }) {
  const { data: result } = useSuspenseQuery(networkSearchQuery(prompt));
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selectedPerson = result.people.find(({ linkedinSlug }) => linkedinSlug === selectedSlug);

  if (result.people.length === 0) {
    return (
      <div role="status">
        <EmptyState
          icon={Search}
          title="Nobody in your network matches"
          description="Try different words. A role, a company or a city often works."
        />
      </div>
    );
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6">
      <section aria-labelledby="results-heading">
        <h2 id="results-heading" className="type-h3 mb-3.5">
          {readPeopleHeading(result.people.length)}
        </h2>
        <ul aria-label="Search results" className="grid gap-3">
          {result.people.map((person, position) => (
            <PersonResult
              key={person.linkedinSlug ?? `${person.fullName}-${position}`}
              person={person}
              isSelected={selectedSlug !== null && person.linkedinSlug === selectedSlug}
              viewer={viewer}
              onSelect={setSelectedSlug}
            />
          ))}
        </ul>
      </section>
      <div className="hidden lg:sticky lg:top-9 lg:block">
        {selectedPerson?.linkedinSlug ? (
          <PathsPanel person={selectedPerson} linkedinSlug={selectedPerson.linkedinSlug} viewer={viewer} />
        ) : (
          <div className="grid justify-items-center gap-2 rounded-panel bg-muted px-8 py-10 text-center">
            <Waypoints aria-hidden="true" className="size-8 text-brand-emphasis" />
            <p className="type-h3">Pick someone to see the way in</p>
            <p className="type-small text-foreground-soft">
              Choose Show intro paths on a result. Each new lookup uses one of your daily lookups.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChangeLinkedin() {
  const queryClient = useQueryClient();
  return (
    <details className="group rounded-card-phone bg-card shadow-panel sm:rounded-card">
      <summary className="flex min-h-16 list-none items-center justify-between gap-3 rounded-card-phone px-card-phone font-bold sm:rounded-card sm:px-6 [&::-webkit-details-marker]:hidden">
        Change your LinkedIn profile
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-card-phone pb-[18px] sm:px-6 sm:pb-6">
        <LinkedinForm
          submitLabel="Save"
          onSaved={() => queryClient.invalidateQueries({ queryKey: [NETWORK_QUERY_KEYS.status] })}
        />
      </div>
    </details>
  );
}

type SearchHeroProps = { welcome: WelcomeContext; onSearch: (prompt: string) => void };

function SearchHero({ welcome, onSearch }: SearchHeroProps) {
  const [draft, setDraft] = useState("");
  return (
    <section aria-labelledby="network-title" className="rounded-card bg-accent px-card-phone py-7 sm:rounded-panel sm:px-10 sm:pt-10 sm:pb-8">
      <h1 id="network-title" className="type-h1 text-center">
        Who do you want to meet?
      </h1>
      <div className="type-lead mt-2 flex flex-wrap items-center justify-center gap-3 text-center text-foreground-soft">
        {welcome.neighbours.length > 0 ? (
          <span aria-hidden="true" className="inline-flex">
            {welcome.neighbours.slice(0, STACKED_FACES).map(({ id, name }) => (
              <Avatar
                key={id}
                stableId={id}
                name={name}
                sizePx={32}
                className="-ml-2.5 shadow-[0_0_0_2.5px_var(--accent)] first:ml-0"
              />
            ))}
          </span>
        ) : null}
        <p>{readSearchScope(welcome.sharingMemberCount)}</p>
      </div>
      <form
        action={(formData) => onSearch(String(formData.get(PROMPT_FIELD)))}
        className="mx-auto mt-6 flex max-w-[760px] flex-wrap items-center gap-2 rounded-[38px] bg-card p-2 pl-5 text-brand-emphasis shadow-[0_0_0_2px_var(--brand-emphasis),var(--elevation-panel)] focus-within:shadow-[0_0_0_3px_var(--brand-emphasis),0_0_0_6px_var(--accent),var(--elevation-panel)] sm:min-h-[76px] sm:flex-nowrap sm:gap-3.5 sm:pl-[26px]"
      >
        <Search aria-hidden="true" className="size-6 shrink-0" />
        <label htmlFor={PROMPT_FIELD} className="sr-only">
          Who are you looking for?
        </label>
        <input
          id={PROMPT_FIELD}
          name={PROMPT_FIELD}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          required
          placeholder="Fintech founders in London"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-lg leading-7 font-semibold text-foreground outline-none sm:text-xl"
        />
        <Button type="submit" size="lg" className="max-sm:w-full">
          Search
        </Button>
      </form>
      <p className="type-small mt-3 text-center text-foreground-soft">{SEARCH_DURATION_NOTE}</p>
      <ul aria-label="Search ideas" className="mt-3 flex flex-wrap justify-center gap-2">
        {SEARCH_EXAMPLES.map((example) => (
          <li key={example}>
            <button
              type="button"
              onClick={() => setDraft(example)}
              className="inline-flex min-h-11 items-center rounded-full bg-card px-card-phone text-[15px] leading-5 font-semibold text-foreground-soft hover:text-foreground hover:shadow-[inset_0_0_0_1.5px_var(--input)]"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NetworkSearch({ welcome }: { welcome: WelcomeContext }) {
  const [prompt, setPrompt] = useState<string | null>(null);

  return (
    <div className="grid gap-6">
      <SearchHero welcome={welcome} onSearch={setPrompt} />
      {prompt ? (
        <QueryBoundary
          key={prompt}
          loadingMessage="Searching your network…"
          fallback={
            <LoadingState
              person={welcome.member}
              title="Searching your network…"
              description={`${prompt}. ${SEARCH_DURATION_NOTE}`}
            />
          }
        >
          <SearchResults prompt={prompt} viewer={welcome.member} />
        </QueryBoundary>
      ) : null}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ChangeLinkedin />
        <Card className="grid gap-4">
          <div className="grid gap-1.5">
            <CardTitle>Leave the group</CardTitle>
            <CardDescription>Stops sharing your network, and your access to others&apos;.</CardDescription>
          </div>
          <LeaveGroup />
        </Card>
      </div>
    </div>
  );
}
