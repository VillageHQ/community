import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { INTRO_STATES, type IntroState } from "@/modules/intros/contract";

const STATE_LABELS: Record<IntroState, string> = {
  [INTRO_STATES.requested]: "Waiting for an answer",
  [INTRO_STATES.accepted]: "Said yes",
  [INTRO_STATES.completed]: "Introduced",
  [INTRO_STATES.declined]: "Declined",
  [INTRO_STATES.withdrawn]: "Withdrawn",
  [INTRO_STATES.expired]: "Expired",
};

export function IntroCountsCard({ counts }: { counts: { state: IntroState; count: number }[] }) {
  return (
    <Card className="grid gap-4">
      <div className="grid gap-1.5">
        <CardTitle>Intros</CardTitle>
        <CardDescription>Counts only. Who asked whom, and what they wrote, stays between the two members.</CardDescription>
      </div>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {counts.map(({ state, count }) => (
          <div key={state} className="rounded-field bg-muted px-4 py-3">
            <dt className="type-small text-foreground-soft">{STATE_LABELS[state]}</dt>
            <dd className="type-h3">{count}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
