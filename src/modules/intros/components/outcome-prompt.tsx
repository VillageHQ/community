"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Hourglass, Sparkles, X, type LucideIcon } from "lucide-react";
import { useId } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INTRO_OUTCOMES, type Intro, type IntroOutcome } from "@/modules/intros/contract";
import { INTRO_QUERY_KEYS, recordIntroOutcomeRequest } from "@/modules/intros/queries";
import { readFirstName } from "@/platform/design/avatar-identity";

const OUTCOME_CHOICES: { outcome: IntroOutcome; label: string; icon: LucideIcon; variant: "primary" | "outline" }[] = [
  { outcome: INTRO_OUTCOMES.helped, label: "Yes, it helped", icon: Check, variant: "primary" },
  { outcome: INTRO_OUTCOMES.notYet, label: "Not yet", icon: Hourglass, variant: "outline" },
  { outcome: INTRO_OUTCOMES.notHelped, label: "No", icon: X, variant: "outline" },
];

const OUTCOME_THANKS: Record<IntroOutcome, string> = {
  [INTRO_OUTCOMES.helped]: "That's great to hear. Thanks for telling us.",
  [INTRO_OUTCOMES.notYet]: "No problem. We'll ask again in a week.",
  [INTRO_OUTCOMES.notHelped]: "Thanks for telling us. We won't ask again.",
};

export function OutcomePrompt({ intro }: { intro: Intro }) {
  const queryClient = useQueryClient();
  const headingId = useId();
  const targetFirst = readFirstName(intro.target.name);
  const record = useMutation({
    mutationFn: (outcome: IntroOutcome) => recordIntroOutcomeRequest({ introId: intro.id, outcome }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INTRO_QUERY_KEYS.counts] }),
  });

  if (record.data) {
    return (
      <Card role="status" className="sm:rounded-panel">
        <p className="type-body flex items-center gap-2.5">
          <Sparkles aria-hidden="true" className="size-5 shrink-0 text-brand-emphasis" />
          {record.data.outcome ? OUTCOME_THANKS[record.data.outcome] : null}
        </p>
      </Card>
    );
  }

  return (
    <section aria-labelledby={headingId}>
      <Card className="grid gap-4 sm:rounded-panel">
        <div className="grid gap-1.5">
          <h3 id={headingId} className="type-h2 wrap-anywhere">
            Did your intro to {targetFirst} help?
          </h3>
          <p className="type-note text-foreground-soft">
            {readFirstName(intro.introducer.name)} connected you a while ago. Your answer helps this community see what works. Admins only see totals.
          </p>
        </div>
        <FormError message={record.error?.message ?? null} />
        <div className="grid gap-2 sm:grid-cols-3">
          {OUTCOME_CHOICES.map(({ outcome, label, icon: Icon, variant }) => (
            <Button key={outcome} type="button" size="lg" variant={variant} disabled={record.isPending} onClick={() => record.mutate(outcome)}>
              <Icon aria-hidden="true" />
              {label}
            </Button>
          ))}
        </div>
      </Card>
    </section>
  );
}
