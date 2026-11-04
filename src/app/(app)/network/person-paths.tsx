"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { Fragment } from "react";

import { CommunityMemberBadge } from "@/components/community-member-badge";
import type { ConstellationPerson } from "@/components/constellation";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { readFirstName } from "@/lib/design/avatar-identity";
import type { NetworkPath } from "@/lib/village/network-api";

import { networkPathsQuery } from "./network-queries";

const YOU_LABEL = "You";
const PATH_NODE_SIZE_PX = 44;

type PathNode = { id: string; name: string; label: string };

function readPathNodes(path: NetworkPath, viewer: ConstellationPerson, targetName: string, targetSlug: string): PathNode[] {
  const others = path.starters
    .filter((starter) => !starter.isCurrentUser)
    .slice(0, 1)
    .map((starter) => ({ id: starter.linkedinSlug ?? starter.name, name: starter.name, label: readFirstName(starter.name) }));
  const introducer = path.introducer
    ? [
        {
          id: path.introducer.linkedinSlug ?? path.introducer.name,
          name: path.introducer.name,
          label: readFirstName(path.introducer.name),
        },
      ]
    : [];
  return [
    { id: viewer.id, name: viewer.name, label: YOU_LABEL },
    ...others,
    ...introducer,
    { id: targetSlug, name: targetName, label: readFirstName(targetName) },
  ];
}

function PathDiagram({ nodes }: { nodes: PathNode[] }) {
  return (
    <div aria-hidden="true" className="flex items-start rounded-field bg-muted px-4 pt-4 pb-3">
      {nodes.map(({ id, name, label }, position) => (
        <Fragment key={id}>
          {position > 0 ? <span className="mx-1 mt-[21px] h-[3px] min-w-3 flex-1 rounded-full bg-brand-emphasis" /> : null}
          <span className="flex min-w-0 flex-[0_1_72px] flex-col items-center gap-1.5 text-center text-[14px] leading-[18px] font-bold">
            <Avatar stableId={id} name={name} sizePx={PATH_NODE_SIZE_PX} />
            <span className="w-full truncate">{label}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

type PathPerson = { name: string; linkedinSlug: string | null; isMember: boolean };

function PathPersonRow({ person, role }: { person: PathPerson; role: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar stableId={person.linkedinSlug ?? person.name} name={person.name} sizePx={PATH_NODE_SIZE_PX} />
      <div className="min-w-0">
        <div className="text-base leading-[22px] font-bold wrap-anywhere">{person.name}</div>
        <div className="type-small text-muted-foreground">{role}</div>
        {person.isMember ? (
          <div className="mt-1.5">
            <CommunityMemberBadge />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PathRow({ path, isTop }: { path: NetworkPath; isTop: boolean }) {
  const otherStarters = path.starters.filter((starter) => !starter.isCurrentUser);

  return (
    <li
      className={
        isTop
          ? "grid gap-3.5 rounded-field p-5 shadow-[inset_0_0_0_2.5px_var(--brand-emphasis)]"
          : "grid gap-3.5 rounded-field p-card-phone shadow-[inset_0_0_0_1.5px_var(--border)]"
      }
    >
      {path.introducer ? <PathPersonRow person={path.introducer} role="Introducer" /> : null}
      {otherStarters.map((starter) => (
        <PathPersonRow key={starter.linkedinSlug ?? starter.name} person={starter} role="Ask" />
      ))}
      {path.description ? (
        <p className="flex gap-2.5 type-note text-foreground-soft">
          <Link2 aria-hidden="true" className="mt-[3px] size-icon-small shrink-0 text-brand-emphasis" />
          <span className="min-w-0">{path.description}</span>
        </p>
      ) : null}
      {path.scoreLabel ? (
        <div>
          <Tag>Strength: {path.scoreLabel}</Tag>
        </div>
      ) : null}
    </li>
  );
}

type PersonPathsProps = { linkedinSlug: string; personName: string; viewer: ConstellationPerson };

export function PersonPaths({ linkedinSlug, personName, viewer }: PersonPathsProps) {
  const { data: result } = useSuspenseQuery(networkPathsQuery(linkedinSlug));
  const [topPath] = result.paths;

  if (!topPath) {
    return (
      <p role="status" className="type-small rounded-field bg-muted p-4 text-foreground-soft">
        No intro paths yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <PathDiagram nodes={readPathNodes(topPath, viewer, personName, linkedinSlug)} />
      <ul aria-label="Intro paths" className="grid gap-3">
        {result.paths.map((path, position) => (
          <PathRow key={position} path={path} isTop={position === 0} />
        ))}
      </ul>
    </div>
  );
}
