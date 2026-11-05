import Link from "next/link";

import { ProgressTrack } from "@/components/progress-track";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { readNewMembers } from "@/lib/members/directory";
import type { NextStep } from "@/lib/next-steps";
import { ROUTES } from "@/lib/routes";

import { FEED_AVATAR_SIZES } from "./feed-display";

type NewMember = Awaited<ReturnType<typeof readNewMembers>>["newMembers"][number];

function NewMemberRow({ member }: { member: NewMember }) {
  const { id, name, title, company, avatarUrl } = member;
  return (
    <li className="flex items-center gap-3">
      <Avatar stableId={id} name={name} imageUrl={avatarUrl} sizePx={FEED_AVATAR_SIZES.rail} />
      <div className="min-w-0 flex-1">
        <div className="type-label wrap-anywhere">{name}</div>
        <div className="type-micro font-medium wrap-anywhere text-muted-foreground">{company ?? title ?? "New member"}</div>
      </div>
      <Button asChild variant="soft" size="sm" className="px-4">
        <Link href={`${ROUTES.members}/${id}`} aria-label={`View profile of ${name}`}>
          View
        </Link>
      </Button>
    </li>
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
