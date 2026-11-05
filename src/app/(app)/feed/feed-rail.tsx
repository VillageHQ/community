import Link from "next/link";

import { ProgressTrack } from "@/components/progress-track";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { readFirstName } from "@/platform/design/avatar-identity";
import { INTRO_LIMITS, INTRO_STATES, type Intro } from "@/lib/intros/intro-api";
import type { readNewMembers } from "@/modules/members/reads-directory";
import type { NextStep } from "@/lib/next-steps";
import { ROUTES } from "@/platform/http/routes";

import { MemberConversationSlot } from "@/modules/members/slots";
import { FEED_AVATAR_SIZES } from "./feed-display";

type NewMember = Awaited<ReturnType<typeof readNewMembers>>["newMembers"][number];

function NewMemberRow({ member }: { member: NewMember }) {
  const { id, name, title, company, avatarUrl } = member;
  return (
    <li className="flex flex-wrap items-center gap-3">
      <Avatar stableId={id} name={name} imageUrl={avatarUrl} sizePx={FEED_AVATAR_SIZES.rail} />
      <div className="min-w-0 flex-1">
        <Link href={`${ROUTES.members}/${id}`} className="type-label wrap-anywhere hover:underline">
          {name}
        </Link>
        <div className="type-micro font-medium wrap-anywhere text-muted-foreground">{company ?? title ?? "New member"}</div>
      </div>
      <MemberConversationSlot
        memberId={id}
        label="Say hi"
        accessibleName={`Say hi to ${name}`}
        showsIcon={false}
        variant="soft"
        size="sm"
        className="px-4"
      />
    </li>
  );
}

function describeWaitingIntro({ state, requester, target }: Intro) {
  const firstName = readFirstName(requester.name);
  if (state === INTRO_STATES.accepted) {
    return { title: `You said yes to ${firstName}`, detail: `Now connect them with ${target.name}`, action: "Finish the intro" };
  }
  return { title: `${firstName} needs an intro`, detail: `to ${target.name}`, action: `Review ${firstName}'s ask` };
}

function WaitingIntroRow({ intro }: { intro: Intro }) {
  const { id, requester } = intro;
  const { title, detail, action } = describeWaitingIntro(intro);
  return (
    <li className="grid gap-3.5">
      <div className="flex items-center gap-3">
        <Avatar stableId={requester.id} name={requester.name} imageUrl={requester.avatarUrl} sizePx={FEED_AVATAR_SIZES.rail} />
        <div className="min-w-0">
          <p className="type-label wrap-anywhere">{title}</p>
          <p className="type-micro font-medium wrap-anywhere text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Button asChild className="w-full">
        <Link href={`${ROUTES.intros}/${id}`}>{action}</Link>
      </Button>
    </li>
  );
}

export function WaitingOnYouCard({ intros }: { intros: Intro[] }) {
  const moreCount = intros.length - INTRO_LIMITS.shownInRail;
  return (
    <Card className="sm:p-5">
      <CardTitle>Waiting on you</CardTitle>
      <ul className="mt-3.5 grid gap-5">
        {intros.slice(0, INTRO_LIMITS.shownInRail).map((intro) => (
          <WaitingIntroRow key={intro.id} intro={intro} />
        ))}
      </ul>
      {moreCount > 0 ? (
        <Button asChild variant="quiet" size="sm" className="mt-2 w-full">
          <Link href={ROUTES.intros}>See {moreCount} more</Link>
        </Button>
      ) : null}
    </Card>
  );
}

export function NewThisWeekCard({ newMembers }: { newMembers: NewMember[] }) {
  return (
    <Card className="sm:p-5">
      <CardTitle>New this week</CardTitle>
      {newMembers.length === 0 ? (
        <>
          <p className="type-small mt-2 text-foreground-soft">Nobody new this week. Everyone else is one tap away.</p>
          <Button asChild variant="outline" size="sm" className="mt-3.5 w-full">
            <Link href={ROUTES.members}>Meet the members</Link>
          </Button>
        </>
      ) : (
        <ul className="mt-3.5 grid gap-3.5">
          {newMembers.map((member) => (
            <NewMemberRow key={member.id} member={member} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function NextStepCard({ nextStep }: { nextStep: NextStep }) {
  const { icon: Icon, kicker, title, description, action, progress } = nextStep;
  return (
    <Card className="sm:p-5">
      <p className="type-micro flex items-center gap-2 font-bold text-brand-emphasis">
        <Icon aria-hidden="true" className="size-icon-small shrink-0" />
        {kicker}
      </p>
      <CardTitle className="mt-1.5">{title}</CardTitle>
      <p className="type-small mt-1.5 text-foreground-soft">{description}</p>
      {progress ? (
        <div className="mt-3.5">
          <ProgressTrack {...progress} />
        </div>
      ) : null}
      {action ? (
        <Button asChild className="mt-3.5 w-full">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </Card>
  );
}
