"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { CommunityMemberBadge } from "@/components/community-member-badge";
import { FormField } from "@/components/form-field";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toLinkedinUrl } from "@/lib/village/linkedin-slug";
import type { NetworkPerson } from "@/lib/village/network-api";

import { LeaveGroup } from "./leave-group";
import { LinkedinStep } from "./linkedin-step";
import { networkSearchQuery } from "./network-queries";
import { PersonPaths } from "./person-paths";

const PROMPT_FIELD = "prompt";

function PersonResult({ person }: { person: NetworkPerson }) {
  const [arePathsOpen, setArePathsOpen] = useState(false);
  const { linkedinSlug } = person;

  return (
    <li className="grid gap-2 border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        {linkedinSlug ? (
          <a className="font-medium underline" href={toLinkedinUrl(linkedinSlug)} rel="noreferrer" target="_blank">
            {person.fullName}
          </a>
        ) : (
          <span className="font-medium">{person.fullName}</span>
        )}
        {person.isMember ? <CommunityMemberBadge /> : null}
      </div>
      {person.headline ? <p className="text-sm text-muted-foreground">{person.headline}</p> : null}
      {linkedinSlug && !arePathsOpen ? (
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => setArePathsOpen(true)}>
            Show intro paths
          </Button>
        </div>
      ) : null}
      {linkedinSlug && arePathsOpen ? (
        <QueryBoundary loadingMessage="Finding intro paths…">
          <PersonPaths linkedinSlug={linkedinSlug} />
        </QueryBoundary>
      ) : null}
    </li>
  );
}

function SearchResults({ prompt }: { prompt: string }) {
  const { data: result } = useSuspenseQuery(networkSearchQuery(prompt));

  if (result.people.length === 0) {
    return (
      <p role="status" className="text-sm">
        Nobody in your network matches. Try different words.
      </p>
    );
  }

  return (
    <ul aria-label="Search results" className="grid">
      {result.people.map((person, position) => (
        <PersonResult key={person.linkedinSlug ?? `${person.fullName}-${position}`} person={person} />
      ))}
    </ul>
  );
}

export function NetworkSearch() {
  const [prompt, setPrompt] = useState<string | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Search your network</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form
            action={(formData) => setPrompt(String(formData.get(PROMPT_FIELD)))}
            className="grid gap-4"
          >
            <FormField
              name={PROMPT_FIELD}
              label="Who are you looking for?"
              hint="For example: fintech founders in London. Searches can take a minute or more."
              defaultValue={prompt ?? ""}
              required
            />
            <Button type="submit">Search</Button>
          </form>
          {prompt ? (
            <QueryBoundary key={prompt} loadingMessage="Searching your network…">
              <SearchResults prompt={prompt} />
            </QueryBoundary>
          ) : null}
        </CardContent>
      </Card>
      <LeaveGroup />
      <details className="text-sm">
        <summary className="cursor-pointer">Change your LinkedIn profile</summary>
        <div className="pt-2">
          <LinkedinStep />
        </div>
      </details>
    </>
  );
}
