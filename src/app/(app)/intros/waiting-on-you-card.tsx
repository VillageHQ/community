import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { readFirstName } from "@/platform/design/avatar-identity";
import { INTRO_LIMITS, INTRO_STATES, type Intro } from "@/lib/intros/intro-api";
import { ROUTES } from "@/platform/http/routes";

const RAIL_AVATAR_SIZE_PX = 44;

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
        <Avatar stableId={requester.id} name={requester.name} imageUrl={requester.avatarUrl} sizePx={RAIL_AVATAR_SIZE_PX} />
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
