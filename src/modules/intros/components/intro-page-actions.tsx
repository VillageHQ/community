"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { useFlash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { OptionCard } from "@/components/ui/checkbox-card";
import { RequestFailure } from "@/platform/http/post-request";
import { readFirstName } from "@/platform/design/avatar-identity";
import { MemberConversationSlot } from "@/modules/members/slots";

import { INTRO_ACTIONS, INTRO_RESULTS, OUTCOME_BY_CHOICE, OUTCOME_CHOICES, type Intro, type IntroResult, type OutcomeChoice } from "../contract";
import { answerAsConnectorRequest, recordIntroOutcomeRequest, transitionIntroRequest } from "../queries";
import { DecisionForm } from "./intro-decision";
import { CHOICE_BY_OUTCOME, OUTCOME_LABELS, RESULT_LABELS, readConnectorChoices, readTargetEmailHint, readTargetEmailLabel } from "./intro-words";

// Founderhall's flashes after a redirect (`?m=asked`, `?m=withdrawn`, `?m=outcome`).
const FLASHES: Record<string, string> = {
  asked: "Asked. We emailed your note; you hear back here and by email.",
  withdrawn: "Withdrawn. Your ask is back.",
  outcome: "Thank you. Your answer is counted.",
};

export function FlashOnArrival() {
  const searchParams = useSearchParams();
  const show = useFlash();
  const shown = useRef<string | null>(null);
  const key = searchParams.get("m");
  useEffect(() => {
    const text = key ? FLASHES[key] : undefined;
    if (!text || shown.current === key) return;
    shown.current = key;
    show(text);
  }, [key, show]);
  return null;
}

function useGoTo() {
  const router = useRouter();
  return (flash: string | null) => {
    router.replace(flash ? `?m=${flash}` : "?", { scroll: true });
    router.refresh();
  };
}

// The connector's answer on the intro page: the same form as the public page.
export function ConnectorAnswer({ intro, community, canEmail }: { intro: Intro; community: string; canEmail: boolean }) {
  const goTo = useGoTo();
  return (
    <DecisionForm
      legend="Would you introduce them?"
      choices={readConnectorChoices(intro, community)}
      email={canEmail ? { label: readTargetEmailLabel(intro), hint: readTargetEmailHint(intro), initial: intro.suggestedTargetEmail } : null}
      note={intro.note}
      withPrivateNote
      submit={async ({ choice, targetEmail, note, privateNote }) => {
        await answerAsConnectorRequest({ introId: intro.id, choice: choice as "yes" | "not_now" | "dont_know", targetEmail, note, reason: privateNote });
        goTo(null);
      }}
    />
  );
}

// "Withdraw my ask" (`.withdraw`): a quiet button and the line under it.
export function WithdrawAsk({ introId, hint }: { introId: string; hint: string }) {
  const goTo = useGoTo();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setIsPending(true);
    try {
      await transitionIntroRequest({ introId, action: INTRO_ACTIONS.withdraw });
      goTo("withdrawn");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That didn't work. Try again.");
    } finally {
      setIsPending(false);
    }
  }
  return (
    <form className="fh-section fh-withdraw" onSubmit={onSubmit}>
      <Button type="submit" variant="quiet" size="sm" disabled={isPending}>
        Withdraw my ask
      </Button>
      <p className="fh-hint">{hint}</p>
      {error ? (
        <p className="fh-hint fh-err" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

const KNOWN_RESULTS = new Set<string>(Object.values(INTRO_RESULTS));

// "Was the intro to Rosa helpful?" on the asker's page, once it's asked: the ticks, then one button per answer.
export function OutcomeSheet({ intro, targetFirst }: { intro: Intro; targetFirst: string }) {
  const goTo = useGoTo();
  const [error, setError] = useState<string | null>(null);
  const chosen = intro.outcome ? CHOICE_BY_OUTCOME[intro.outcome] : null;
  async function answer(choice: OutcomeChoice, form: HTMLFormElement) {
    const results = new FormData(form)
      .getAll("results")
      .map(String)
      .filter((value): value is IntroResult => KNOWN_RESULTS.has(value));
    try {
      await recordIntroOutcomeRequest({ introId: intro.id, outcome: OUTCOME_BY_CHOICE[choice], results });
      goTo("outcome");
    } catch (failure) {
      setError(failure instanceof RequestFailure || failure instanceof Error ? failure.message : "That didn't work. Try again.");
    }
  }
  return (
    <section className="fh-sheet fh-section">
      <h2 className="fh-h3">Was the intro to {targetFirst} helpful?</h2>
      <form className="mt-2.5" onSubmit={(event) => event.preventDefault()}>
        <fieldset className="fh-choices">
          <legend className="fh-label">
            What came of it? <span className="fh-muted">Tick any</span>
          </legend>
          {Object.entries(RESULT_LABELS).map(([value, label]) => (
            <OptionCard key={value} type="checkbox" id={`outcome-result-${value}`} name="results" value={value} title={label} />
          ))}
        </fieldset>
        <div className="fh-btn-row mt-3.5">
          {Object.values(OUTCOME_CHOICES).map((choice) => (
            <Button
              key={choice}
              type="button"
              size="sm"
              variant={chosen === choice ? "primary" : "secondary"}
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (form) void answer(choice, form);
              }}
            >
              {OUTCOME_LABELS[choice]}
            </Button>
          ))}
        </div>
        {error ? (
          <p className="fh-hint fh-err" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}

// Community's "Message Marcus" for the connector (quiet, beside Report this note). Shown only while Messages is on.
export function MessageAsker({ person }: { person: Intro["requester"] }) {
  if (!person.isAvailable) return null;
  return (
    <MemberConversationSlot
      memberId={person.id}
      label={`Message ${readFirstName(person.name)}`}
      accessibleName={`Message ${person.name}`}
      variant="quiet"
      size="sm"
    />
  );
}
