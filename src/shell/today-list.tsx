import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { HelpableAsksCard } from "@/modules/asks/components/shared/helpable-asks-card";
import { OwnAsksCard } from "@/modules/asks/components/shared/own-asks-card";
import { WaitingOnYouCard } from "@/modules/intros/components/waiting-on-you-card";
import { NewThisWeekCard } from "@/modules/members/components/new-this-week-card";
import { PerksCard } from "@/modules/perks/components/shared/perks-card";
import { ROUTES } from "@/platform/http/routes";

import { NextStepCard } from "./next-step-card";
import type { NextStep } from "./next-steps";
import { isTodayEmpty, type TodayItems } from "./today";

export const TODAY_END_LINE = "That's everything this week.";

// Only what needs the member this week, in the order they should look at it, then a clear end.
type TodayListProps = { today: TodayItems; nextSteps: readonly NextStep[]; perksCommunityName?: string | null };

// `perksCommunityName` is set while Perks is on and has a marketplace; the card sits after the member's own items.
export function TodayList({ today, nextSteps, perksCommunityName = null }: TodayListProps) {
  const intros = [...today.introsToAnswer, ...today.introsToFinish];
  return (
    <section aria-label="This week" className="grid gap-5">
      {isTodayEmpty(today) ? (
        <Card className="sm:p-5">
          <CardTitle>You&apos;re all caught up</CardTitle>
          <p className="type-small mt-1.5 text-foreground-soft">Nothing needs you this week. When someone asks for your help or an intro, it shows up here.</p>
        </Card>
      ) : null}
      {today.helpableAsks.length > 0 ? <HelpableAsksCard asks={today.helpableAsks} /> : null}
      {intros.length > 0 ? <WaitingOnYouCard intros={intros} /> : null}
      {today.profileLines.length > 0 ? (
        <Card className="sm:p-5">
          <CardTitle>Check your card</CardTitle>
          <p className="type-small mt-1.5 text-foreground-soft">We added these from public profiles. Is everything right?</p>
          <ul className="mt-3.5 grid gap-2">
            {today.profileLines.map(({ field, label, value }) => (
              <li key={field} className="type-small min-w-0 wrap-anywhere">
                <span className="text-muted-foreground">{label}:</span> {value}
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" size="sm" className="mt-3.5 w-full">
            <Link href={ROUTES.editCard}>Fix or hide on your card</Link>
          </Button>
        </Card>
      ) : null}
      {today.ownAsks.length > 0 ? <OwnAsksCard asks={today.ownAsks} /> : null}
      <NewThisWeekCard newMembers={today.newMembers} />
      {perksCommunityName ? <PerksCard communityName={perksCommunityName} /> : null}
      {nextSteps.map((nextStep) => (
        <NextStepCard key={nextStep.title} nextStep={nextStep} />
      ))}
      <p className="mt-2 text-center font-serif text-[17px] leading-6 text-foreground-soft italic">{TODAY_END_LINE}</p>
    </section>
  );
}
