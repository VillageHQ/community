"use client";

import { ArrowRight, ExternalLink, Globe, Link2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRef, type RefObject } from "react";

import { CommunityMemberBadge } from "@/components/community-member-badge";
import type { ConstellationPerson } from "@/components/constellation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { readFirstName } from "@/platform/design/avatar-identity";
import { INTRO_STATES, type IntroState } from "@/lib/intros/intro-api";
import { ROUTES } from "@/platform/http/routes";
import { toLinkedinUrl } from "@/lib/village/linkedin-slug";
import type { Connector } from "@/lib/village/network-api";

import { StartConversationButton } from "@/app/(app)/messages/start-conversation-button";
import { AskIntroDialog } from "./ask-intro-dialog";

const CONNECTOR_AVATAR_SIZE_PX = 52;
export const OUTSIDE_COMMUNITY_LABEL = "Outside this community";

const OPEN_ASK_LABELS: Partial<Record<IntroState, (firstName: string) => string>> = {
  [INTRO_STATES.requested]: (firstName) => `You asked. Waiting on ${firstName}.`,
  [INTRO_STATES.accepted]: (firstName) => `${firstName} said yes.`,
};

type ConnectorCardProps = {
  connector: Connector;
  isTop: boolean;
  targetSlug: string;
  targetName: string;
  viewer: ConstellationPerson;
};

function ConnectorHeading({ connector }: { connector: Connector }) {
  const { name, member } = connector;
  if (member) {
    return (
      <Link href={`${ROUTES.members}/${member.id}`} className="underline-offset-3 hover:underline">
        {name}
      </Link>
    );
  }
  return name;
}

function ReasonLine({ reason }: { reason: string }) {
  return (
    <p className="flex gap-2.5 type-note text-foreground-soft">
      <Link2 aria-hidden="true" className="mt-[3px] size-icon-small shrink-0 text-brand-emphasis" />
      <span className="min-w-0 wrap-anywhere">{reason}</span>
    </p>
  );
}

function OutsideActions({ connector }: { connector: Connector }) {
  const firstName = readFirstName(connector.name);
  return (
    <>
      <p className="type-small text-foreground-soft">
        We can&apos;t reach {firstName} from here, so there&apos;s no intro to request. If you know {firstName}, you could ask directly on LinkedIn.
      </p>
      {connector.linkedinSlug ? (
        <Button asChild variant="outline" size="default" className="w-full">
          <a href={toLinkedinUrl(connector.linkedinSlug)} target="_blank" rel="noreferrer">
            {firstName} on LinkedIn
            <ExternalLink aria-hidden="true" className="size-4" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      ) : null}
    </>
  );
}

type OpenAskRowProps = {
  openAsk: NonNullable<Connector["openAsk"]>;
  firstName: string;
  linkRef: RefObject<HTMLAnchorElement | null>;
};

function OpenAskRow({ openAsk, firstName, linkRef }: OpenAskRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-field bg-accent px-4 py-3">
      <p className="type-label text-accent-foreground">{OPEN_ASK_LABELS[openAsk.state]?.(firstName)}</p>
      <Button asChild variant="quiet" size="sm">
        <Link ref={linkRef} href={`${ROUTES.intros}/${openAsk.id}`}>
          See your ask
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}

function MemberActions({ connector, isTop, targetSlug, targetName, viewer }: ConnectorCardProps) {
  const { member, linkedinSlug, name, openAsk } = connector;
  const openAskLink = useRef<HTMLAnchorElement>(null);
  if (!member || !linkedinSlug) return null;
  const firstName = readFirstName(name);
  const askLabel = isTop ? `Ask ${firstName} for an intro` : "Ask for an intro";
  const askName = `Ask ${firstName} for an intro to ${readFirstName(targetName)}`;

  return (
    <>
      {openAsk ? <OpenAskRow openAsk={openAsk} firstName={firstName} linkRef={openAskLink} /> : null}
      <AskIntroDialog
        connector={connector}
        connectorSlug={linkedinSlug}
        targetSlug={targetSlug}
        targetName={targetName}
        viewer={viewer}
        afterAskFocus={openAskLink}
        trigger={
          openAsk ? null : (
            <Button type="button" size={isTop ? "lg" : "default"} variant={isTop ? "primary" : "soft"} aria-label={askName} className="w-full">
              {askLabel}
              {isTop ? <ArrowRight aria-hidden="true" /> : null}
            </Button>
          )
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <StartConversationButton memberId={member.id} label="Message" accessibleName={`Message ${name}`} variant="outline" size="sm" />
        <Button asChild variant="outline" size="sm">
          <Link href={`${ROUTES.members}/${member.id}`} aria-label={`See ${name}'s profile`}>
            <UserRound aria-hidden="true" />
            Profile
          </Link>
        </Button>
      </div>
    </>
  );
}

export function ConnectorCard(props: ConnectorCardProps) {
  const { connector, isTop } = props;
  const { name, headline, linkedinSlug, reason, member } = connector;

  return (
    <article
      data-slot="connector"
      data-top={isTop}
      aria-label={name}
      className={
        isTop
          ? "grid gap-3.5 rounded-field p-5 shadow-[inset_0_0_0_2.5px_var(--brand-emphasis)]"
          : "grid gap-3.5 rounded-field p-[18px] shadow-[inset_0_0_0_1.5px_var(--border)]"
      }
    >
      <div className="flex items-center gap-3">
        <Avatar stableId={member?.id ?? linkedinSlug ?? name} name={name} imageUrl={member?.avatarUrl} sizePx={CONNECTOR_AVATAR_SIZE_PX} />
        <div className="min-w-0">
          <h3 className="text-base leading-[22px] font-bold wrap-anywhere">
            <ConnectorHeading connector={connector} />
          </h3>
          {headline ? <p className="type-small wrap-anywhere text-muted-foreground">{headline}</p> : null}
        </div>
      </div>
      <div>
        {member ? (
          <CommunityMemberBadge />
        ) : (
          <Tag tone="neutral" className="font-bold">
            <Globe aria-hidden="true" />
            {OUTSIDE_COMMUNITY_LABEL}
          </Tag>
        )}
      </div>
      <ReasonLine reason={reason} />
      {member ? <MemberActions {...props} /> : <OutsideActions connector={connector} />}
    </article>
  );
}
