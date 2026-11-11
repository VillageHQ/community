"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Hourglass, Sparkles, X, type LucideIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INTRO_OUTCOMES, INTRO_RESULTS, type Intro, type IntroOutcome, type IntroResult } from "@/modules/intros/contract";
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

const RESULT_CHOICES: { result: IntroResult; label: string }[] = [
  { result: INTRO_RESULTS.customer, label: "A customer conversation" },
  { result: INTRO_RESULTS.hire, label: "A hire" },
  { result: INTRO_RESULTS.investor, label: "An investor meeting" },
];

const RESULT_FIELD = "result";

function readResults(form: HTMLFormElement) {
  const ticked = new FormData(form).getAll(RESULT_FIELD);
  return RESULT_CHOICES.map(({ result }) => result).filter((result) => ticked.includes(result));
}

type OutcomeAnswer = { outcome: IntroOutcome; results: IntroResult[] };

// After "Yes, it helped": what came of it. Optional, so "Send" with nothing ticked still records the yes.
function ResultsStep({ targetFirst, isPending, onSend, onBack }: { targetFirst: string; isPending: boolean; onSend: (results: IntroResult[]) => void; onBack: () => void }) {
  const legendId = useId();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSend(readResults(event.currentTarget));
  }
  return (
    <form onSubmit={submit} className="grid gap-3">
      <fieldset aria-labelledby={legendId} className="grid gap-2">
        <legend id={legendId} className="type-label mb-1">
          Great. Did it lead to any of these with {targetFirst}? Tick any that apply.
        </legend>
        {RESULT_CHOICES.map(({ result, label }) => (
          <label key={result} className="flex min-h-12 items-center gap-3 rounded-field px-4 py-2 font-bold shadow-[inset_0_0_0_1.5px_var(--input)] has-checked:shadow-[inset_0_0_0_2.5px_var(--brand-emphasis)]">
            <input type="checkbox" name={RESULT_FIELD} value={result} className="size-5 shrink-0 accent-(--primary)" />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          <Check aria-hidden="true" />
          Send
        </Button>
        <Button type="button" variant="quiet" disabled={isPending} onClick={onBack}>
          Back
        </Button>
      </div>
    </form>
  );
}

export function OutcomePrompt({ intro }: { intro: Intro }) {
  const queryClient = useQueryClient();
  const headingId = useId();
  const targetFirst = readFirstName(intro.target.name);
  const [isAskingResults, setIsAskingResults] = useState(false);
  const record = useMutation({
    mutationFn: ({ outcome, results }: OutcomeAnswer) => recordIntroOutcomeRequest({ introId: intro.id, outcome, results }),
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
            {readFirstName(intro.introducer.name)} connected you a while ago. Your answer helps this community see what works. Admins see your answer.
          </p>
        </div>
        <FormError message={record.error?.message ?? null} />
        {isAskingResults ? (
          <ResultsStep
            targetFirst={targetFirst}
            isPending={record.isPending}
            onSend={(results) => record.mutate({ outcome: INTRO_OUTCOMES.helped, results })}
            onBack={() => setIsAskingResults(false)}
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {OUTCOME_CHOICES.map(({ outcome, label, icon: Icon, variant }) => (
              <Button
                key={outcome}
                type="button"
                size="lg"
                variant={variant}
                disabled={record.isPending}
                onClick={() => (outcome === INTRO_OUTCOMES.helped ? setIsAskingResults(true) : record.mutate({ outcome, results: [] }))}
              >
                <Icon aria-hidden="true" />
                {label}
              </Button>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
