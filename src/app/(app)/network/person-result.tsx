"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ExternalLink } from "lucide-react";

import { CommunityMemberBadge } from "@/components/community-member-badge";
import { Avatar } from "@/components/ui/avatar";
import { toLinkedinUrl } from "@/lib/village/linkedin-slug";
import type { NetworkPaths, NetworkPerson } from "@/lib/village/network-api";

import { networkPathsQuery } from "./network-queries";

const RESULT_AVATAR_SIZE_PX = 56;
const STACKED_CONNECTOR_SIZE_PX = 30;
const STACKED_CONNECTORS = 3;

function describeWaysIn(count: number) {
  return count === 1 ? "1 way in" : `${count} ways in`;
}

function readNoConnectorLabel({ targetMemberId, isDirectConnection }: NetworkPaths) {
  if (targetMemberId) return "In this community";
  return isDirectConnection ? "You know them" : "No warm path yet";
}

function WaysIn({ linkedinSlug }: { linkedinSlug: string }) {
  const { data: paths } = useQuery({ ...networkPathsQuery(linkedinSlug), enabled: false });
  if (!paths) {
    return (
      <span className="type-micro inline-flex items-center gap-1 whitespace-nowrap font-bold text-brand-emphasis">
        Who knows them
        <ChevronRight aria-hidden="true" className="size-4" />
      </span>
    );
  }
  if (paths.connectors.length === 0) {
    return <span className="type-micro whitespace-nowrap text-muted-foreground">{readNoConnectorLabel(paths)}</span>;
  }
  return (
    <span className="flex flex-col items-end gap-1.5">
      <span aria-hidden="true" className="inline-flex">
        {paths.connectors.slice(0, STACKED_CONNECTORS).map(({ name, linkedinSlug: connectorSlug, member }) => (
          <Avatar
            key={connectorSlug ?? name}
            stableId={member?.id ?? connectorSlug ?? name}
            name={name}
            imageUrl={member?.avatarUrl}
            sizePx={STACKED_CONNECTOR_SIZE_PX}
            className="-ml-2 shadow-[0_0_0_2px_var(--card)] first:ml-0"
          />
        ))}
      </span>
      <span className="type-micro whitespace-nowrap font-bold text-brand-emphasis">{describeWaysIn(paths.connectors.length)}</span>
    </span>
  );
}

function ResultText({ person }: { person: NetworkPerson }) {
  return (
    <span className="grid min-w-0 flex-[1_1_180px] justify-items-start gap-0.5 text-left">
      <span className="text-base leading-[22px] font-bold wrap-anywhere">{person.fullName}</span>
      {person.headline ? <span className="type-small wrap-anywhere text-foreground-soft">{person.headline}</span> : null}
      {person.isMember ? (
        <span className="mt-1">
          <CommunityMemberBadge />
        </span>
      ) : null}
    </span>
  );
}

type PersonResultProps = {
  person: NetworkPerson;
  isSelected: boolean;
  panelId: string;
  onSelect: (linkedinSlug: string | null) => void;
};

export function PersonResult({ person, isSelected, panelId, onSelect }: PersonResultProps) {
  const { fullName, linkedinSlug } = person;
  const stableId = person.memberId ?? linkedinSlug ?? fullName;

  if (!linkedinSlug) {
    return (
      <div className="flex min-h-[92px] items-center gap-3.5 rounded-card bg-card px-[18px] py-4 shadow-panel">
        <Avatar stableId={stableId} name={fullName} sizePx={RESULT_AVATAR_SIZE_PX} />
        <ResultText person={person} />
        <span className="type-micro shrink-0 text-muted-foreground">No profile to look up</span>
      </div>
    );
  }

  return (
    <div
      data-selected={isSelected}
      className="relative flex min-h-[92px] items-center rounded-card bg-card shadow-panel transition-transform duration-150 hover:-translate-y-px motion-reduce:transform-none data-[selected=true]:shadow-[inset_0_0_0_2.5px_var(--brand-emphasis),var(--elevation-panel)]"
    >
      <button
        type="button"
        aria-expanded={isSelected}
        aria-controls={panelId}
        aria-label={`Who can intro you to ${fullName}`}
        onClick={() => onSelect(isSelected ? null : linkedinSlug)}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-3.5 rounded-card py-4 pr-2 pl-[18px]"
      >
        <Avatar stableId={stableId} name={fullName} sizePx={RESULT_AVATAR_SIZE_PX} />
        <ResultText person={person} />
        <span className="ml-auto shrink-0">
          <WaysIn linkedinSlug={linkedinSlug} />
        </span>
      </button>
      <a
        href={toLinkedinUrl(linkedinSlug)}
        target="_blank"
        rel="noreferrer"
        aria-label={`${fullName} on LinkedIn (opens in a new tab)`}
        className="mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ExternalLink aria-hidden="true" className="size-[18px]" />
      </a>
    </div>
  );
}
