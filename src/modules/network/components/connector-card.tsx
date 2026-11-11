"use client";

import { ExternalLink, Globe, Link2 } from "lucide-react";
import Link from "next/link";
import { useContext } from "react";

import { CommunityMemberBadge } from "@/components/community-member-badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";
import { linkedinUrl } from "@villagehq/sdk";
import type { Connector } from "@/modules/network/contract";

import { MemberConversationSlot, MemberConversationSlotContext } from "@/modules/members/slots";
import { ConnectorAskSlot, type ConnectorSlotProps } from "@/modules/network/slots";

const CONNECTOR_AVATAR_SIZE_PX = 52;
export const OUTSIDE_COMMUNITY_LABEL = "Outside this community";

function ConnectorHeading({ connector }: { connector: Connector }) {
  const { name, member } = connector;
  if (member) {
    return (
      <Link href={`${ROUTES.people}/${member.id}`} className="underline-offset-3 hover:underline">
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
          <a href={linkedinUrl(connector.linkedinSlug)} target="_blank" rel="noreferrer">
            {firstName} on LinkedIn
            <ExternalLink aria-hidden="true" className="size-4" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      ) : null}
    </>
  );
}

// `!` because the size classes use the theme's own spacing names, which class merging can't match.
const QUIET_LINK = "min-h-11 px-0! text-[14px]! font-normal text-brand-emphasis";

// One primary step (the ask); a message or the profile stay one quiet line below it.
function MemberActions(props: ConnectorSlotProps) {
  const { member, name } = props.connector;
  const canMessage = useContext(MemberConversationSlotContext) !== null;
  if (!member) return null;

  return (
    <>
      <ConnectorAskSlot {...props} />
      <p className="type-small -my-2 flex flex-wrap items-center gap-x-1.5 text-foreground-soft">
        <span>Or</span>
        {canMessage ? (
          <>
            <MemberConversationSlot
              memberId={member.id}
              label="message them"
              accessibleName={`Message ${name}`}
              variant="link"
              size="sm"
              showsIcon={false}
              className={QUIET_LINK}
            />
            <span aria-hidden="true">·</span>
          </>
        ) : null}
        <Button asChild variant="link" size="sm" className={QUIET_LINK}>
          <Link href={`${ROUTES.people}/${member.id}`} aria-label={`See ${name}'s profile`}>
            see their profile
          </Link>
        </Button>
      </p>
    </>
  );
}

export function ConnectorCard(props: ConnectorSlotProps) {
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
        <Avatar stableId={member?.id ?? linkedinSlug ?? name} name={name} imageUrl={connector.imageUrl} sizePx={CONNECTOR_AVATAR_SIZE_PX} />
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
