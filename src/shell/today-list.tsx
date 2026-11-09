import { Card, CardTitle } from "@/components/ui/card";
import { HelpableAsksCard } from "@/modules/asks/components/shared/helpable-asks-card";
import { OwnAsksCard } from "@/modules/asks/components/shared/own-asks-card";
import { WaitingOnYouCard } from "@/modules/intros/components/waiting-on-you-card";
import { NewThisWeekCard } from "@/modules/members/components/new-this-week-card";

import { NextStepCard } from "./next-step-card";
import type { NextStep } from "./next-steps";
import { isTodayEmpty, type TodayItems } from "./today";

export const TODAY_END_LINE = "That's everything this week.";

// Only what needs the member this week, in the order they should look at it, then a clear end.
export function TodayList({ today, nextSteps }: { today: TodayItems; nextSteps: readonly NextStep[] }) {
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
          <ul className="mt-3.5 grid gap-2">
            {today.profileLines.map(({ field, value }) => (
              <li key={field} className="type-small">
                {value}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {today.ownAsks.length > 0 ? <OwnAsksCard asks={today.ownAsks} /> : null}
      <NewThisWeekCard newMembers={today.newMembers} />
      {nextSteps.map((nextStep) => (
        <NextStepCard key={nextStep.title} nextStep={nextStep} />
      ))}
      <p className="type-small text-center text-muted-foreground">{TODAY_END_LINE}</p>
    </section>
  );
}
