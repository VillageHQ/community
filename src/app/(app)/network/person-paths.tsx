"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink, Lock, MessageCirclePlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import type { ConstellationPerson } from "@/components/constellation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { readFirstName } from "@/platform/design/avatar-identity";
import { readIntroPromise } from "@/lib/intros/intro-copy";
import { ROUTES } from "@/platform/http/routes";
import { toLinkedinUrl } from "@/modules/members/contract-linkedin";
import { LOW_LOOKUPS_LEFT, type Connector } from "@/lib/village/network-api";

import { MemberConversationSlot } from "@/modules/members/slots";
import { ConnectorCard } from "./connector-card";
import { networkPathsQuery } from "./network-queries";

const YOU_LABEL = "You";
const PATH_NODE_SIZE_PX = 44;

type PathNode = { id: string; name: string; label: string; imageUrl?: string | null };

function readPathNodes(connector: Connector, viewer: ConstellationPerson, targetName: string, targetSlug: string): PathNode[] {
  const connectorNode = {
    id: connector.member?.id ?? connector.linkedinSlug ?? connector.name,
    name: connector.name,
    label: readFirstName(connector.name),
    imageUrl: connector.member?.avatarUrl,
  };
  const throughNodes = connector.throughName
    ? [{ id: connector.throughName, name: connector.throughName, label: readFirstName(connector.throughName) }]
    : [];
  return [
    { id: viewer.id, name: viewer.name, label: YOU_LABEL, imageUrl: viewer.imageUrl },
    connectorNode,
    ...throughNodes,
    { id: targetSlug, name: targetName, label: readFirstName(targetName) },
  ];
}

function describePathNodes(nodes: PathNode[]) {
  return nodes.map(({ label }) => label).join(", then ");
}

function PathDiagram({ nodes }: { nodes: PathNode[] }) {
  return (
    <div role="img" aria-label={describePathNodes(nodes)} className="flex items-start rounded-field bg-muted px-4 pt-4 pb-3">
      {nodes.map(({ id, name, label, imageUrl }, position) => (
        <Fragment key={id}>
          {position > 0 ? <span className="mx-1 mt-[21px] h-[3px] min-w-3 flex-1 rounded-full bg-brand-emphasis" /> : null}
          <span className="flex min-w-0 flex-[0_1_72px] flex-col items-center gap-1.5 text-center text-[14px] leading-[18px] font-bold">
            <Avatar stableId={id} name={name} imageUrl={imageUrl} sizePx={PATH_NODE_SIZE_PX} />
            <span className="w-full truncate">{label}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function FellowMemberNote({ memberId, targetName }: { memberId: string; targetName: string }) {
  const firstName = readFirstName(targetName);
  return (
    <div className="grid gap-3 rounded-field bg-accent p-4">
      <p className="type-note flex gap-2.5 text-accent-foreground">
        <UsersRound aria-hidden="true" className="mt-0.5 size-icon-small shrink-0" />
        <span>{firstName} is in this community, so you can just say hello.</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <MemberConversationSlot memberId={memberId} label="Message" accessibleName={`Message ${targetName}`} size="sm" />
        <Button asChild variant="outline" size="sm">
          <Link href={`${ROUTES.members}/${memberId}`} aria-label={`See ${targetName}'s profile`}>
            Profile
          </Link>
        </Button>
      </div>
    </div>
  );
}

function DirectConnectionNote({ targetName, targetSlug }: { targetName: string; targetSlug: string }) {
  const firstName = readFirstName(targetName);
  return (
    <div className="grid gap-3 rounded-field bg-accent p-4">
      <p className="type-note text-accent-foreground">You already know {firstName}, so no intro needed. Reach out directly.</p>
      <Button asChild variant="outline" size="sm">
        <a href={toLinkedinUrl(targetSlug)} target="_blank" rel="noreferrer">
          {firstName} on LinkedIn
          <ExternalLink aria-hidden="true" className="size-4" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </Button>
    </div>
  );
}

function NoWayIn({ targetName }: { targetName: string }) {
  return (
    <div role="status" className="grid justify-items-center gap-2 rounded-field bg-muted px-5 py-7 text-center">
      <MessageCirclePlus aria-hidden="true" className="size-8 text-brand-emphasis" />
      <p className="type-h3">No warm way in yet</p>
      <p className="type-small text-foreground-soft">
        Nobody&apos;s network reaches {readFirstName(targetName)} right now. Ask the community in the feed, or try someone else.
      </p>
      <Button asChild variant="soft" size="sm" className="mt-2">
        <Link href={ROUTES.feed}>Ask in the feed</Link>
      </Button>
    </div>
  );
}

type PersonPathsProps = { linkedinSlug: string; personName: string; viewer: ConstellationPerson };

export function PersonPaths({ linkedinSlug, personName, viewer }: PersonPathsProps) {
  const { data: result } = useSuspenseQuery(networkPathsQuery(linkedinSlug));
  const targetName = result.targetName ?? personName;
  const [topConnector] = result.connectors;
  const firstMember = result.connectors.find(({ member }) => member !== null);
  const hasNotes = result.targetMemberId !== null || result.isDirectConnection || result.isViewer;

  return (
    <div className="grid gap-4">
      {result.isViewer ? <p className="type-note rounded-field bg-accent p-4 text-accent-foreground">That&apos;s you. No intro needed.</p> : null}
      {result.targetMemberId ? <FellowMemberNote memberId={result.targetMemberId} targetName={targetName} /> : null}
      {result.isDirectConnection ? <DirectConnectionNote targetName={targetName} targetSlug={linkedinSlug} /> : null}
      {topConnector ? <PathDiagram nodes={readPathNodes(topConnector, viewer, targetName, linkedinSlug)} /> : null}
      {result.connectors.length > 0 ? (
        <ul aria-label={`People who can intro you to ${targetName}`} className="grid gap-3">
          {result.connectors.map((connector, position) => (
            <li key={connector.linkedinSlug ?? connector.name}>
              <ConnectorCard
                connector={connector}
                isTop={position === 0}
                targetSlug={linkedinSlug}
                targetName={targetName}
                viewer={viewer}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {result.connectors.length === 0 && !hasNotes ? <NoWayIn targetName={targetName} /> : null}
      {firstMember ? (
        <p className="type-small flex gap-2.5 text-foreground-soft">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{readIntroPromise(firstMember.name, targetName)}</span>
        </p>
      ) : null}
      {result.dailyLookupsLeft <= LOW_LOOKUPS_LEFT ? (
        <p className="type-small text-muted-foreground">
          {result.dailyLookupsLeft === 1 ? "1 lookup" : `${result.dailyLookupsLeft} lookups`} left today.
        </p>
      ) : null}
    </div>
  );
}
