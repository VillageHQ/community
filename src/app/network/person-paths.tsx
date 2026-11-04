"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { CommunityMemberBadge } from "@/components/community-member-badge";
import type { NetworkPath } from "@/lib/village/network-api";

import { networkPathsQuery } from "./network-queries";

type PathPerson = { name: string; isMember: boolean };

function PathPersonName({ person, role }: { person: PathPerson; role: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-sm">
      <span className="text-muted-foreground">{role}:</span> {person.name}
      {person.isMember ? <CommunityMemberBadge /> : null}
    </span>
  );
}

function PathRow({ path }: { path: NetworkPath }) {
  const otherStarters = path.starters.filter((starter) => !starter.isCurrentUser);

  return (
    <li className="grid gap-1 rounded-md border p-2">
      {path.description ? <p className="text-sm font-medium">{path.description}</p> : null}
      {path.scoreLabel ? (
        <p className="text-xs text-muted-foreground">Strength: {path.scoreLabel}</p>
      ) : null}
      {path.introducer ? <PathPersonName person={path.introducer} role="Introducer" /> : null}
      {otherStarters.map((starter) => (
        <PathPersonName key={starter.linkedinSlug ?? starter.name} person={starter} role="Ask" />
      ))}
    </li>
  );
}

export function PersonPaths({ linkedinSlug }: { linkedinSlug: string }) {
  const { data: result } = useSuspenseQuery(networkPathsQuery(linkedinSlug));

  if (result.paths.length === 0) {
    return (
      <p role="status" className="text-sm">
        No intro paths yet.
      </p>
    );
  }

  return (
    <ul aria-label="Intro paths" className="grid gap-2">
      {result.paths.map((path, position) => (
        <PathRow key={position} path={path} />
      ))}
    </ul>
  );
}
