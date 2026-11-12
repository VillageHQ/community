"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { OptionCard } from "@/components/ui/checkbox-card";
import { Input } from "@/components/ui/input";
import { ConsentLine } from "@/components/ui/note";
import { Textarea } from "@/components/ui/textarea";
import { RequestFailure } from "@/platform/http/post-request";

import { INTRO_ERROR_CODES, INTRO_LIMITS } from "../contract";
import { RESULT_LABELS } from "./intro-words";

// Founderhall's decision form (`.decide`, crop decide-form.png): option cards, the person's email (only with a yes),
// "Edit the note before it goes on", one block button, the consent line. Used by the connector on the intro page and
// on the public page, by the person asked, and for "Was it helpful?".

export type DecisionChoice = { value: string; title: string; description?: string };

export type DecisionValues = { choice: string; targetEmail: string | null; note: string | null; results: string[]; privateNote: string | null };

const FIELDS = { targetEmail: "target_email", note: "note" } as const;

type Field = (typeof FIELDS)[keyof typeof FIELDS];

const FIELD_BY_CODE: Record<string, Field> = {
  [INTRO_ERROR_CODES.targetEmailMissing]: FIELDS.targetEmail,
  [INTRO_ERROR_CODES.targetEmailRefused]: FIELDS.targetEmail,
  [INTRO_ERROR_CODES.noteInvalid]: FIELDS.note,
};

type DecisionFormProps = {
  legend: string;
  choices: readonly DecisionChoice[];
  initialChoice?: string | null;
  // The person's email, shown while "yes" is picked (Founderhall's `.ifyes`).
  email?: { label: string; hint: string; initial: string | null } | null;
  // The connector may edit the note before it goes on.
  note?: string | null;
  // "What came of it?" ticks, for the outcome question.
  withResults?: boolean;
  hasConsentLine?: boolean;
  // Community's private note when saying no (never shown to the asker); appears only once a "no" is picked.
  withPrivateNote?: boolean;
  submit: (values: DecisionValues) => Promise<void>;
  after?: ReactNode;
  // The step closed meanwhile (answered in another tab): the page shows "Nothing to do" instead of an error.
  onClosed?: () => void;
};

export function DecisionForm({ legend, choices, initialChoice = null, email = null, note = null, withResults = false, hasConsentLine = true, withPrivateNote = false, submit, after, onClosed }: DecisionFormProps) {
  const id = useId();
  const [error, setError] = useState<{ message: string; field: Field | null } | null>(null);
  const [isPending, setIsPending] = useState(false);
  const known = choices.some((choice) => choice.value === initialChoice);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const choice = String(form.get("a") ?? "");
    if (!choice) {
      setError({ message: "Pick an answer.", field: null });
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      await submit({
        choice,
        targetEmail: email ? String(form.get(FIELDS.targetEmail) ?? "").trim() || null : null,
        note: note === null ? null : String(form.get(FIELDS.note) ?? ""),
        results: form.getAll("results").map(String),
        privateNote: withPrivateNote ? String(form.get("reason") ?? "").trim() || null : null,
      });
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "This answer didn't come through. Try again.";
      const code = failure instanceof RequestFailure ? failure.code : null;
      if (code === INTRO_ERROR_CODES.consentLinkClosed && onClosed) {
        onClosed();
        return;
      }
      setError({ message, field: code ? (FIELD_BY_CODE[code] ?? null) : null });
    } finally {
      setIsPending(false);
    }
  }

  const emailError = error?.field === FIELDS.targetEmail ? error.message : null;
  const noteError = error?.field === FIELDS.note ? error.message : null;
  return (
    <form className="fh-decide" onSubmit={onSubmit} noValidate>
      {error && !error.field ? (
        <div className="fh-note fh-needs mb-3" role="alert">
          <span>{error.message}</span>
        </div>
      ) : null}
      <fieldset className="fh-choices">
        <legend className="fh-label">{legend}</legend>
        {choices.map((choice) => (
          <OptionCard
            key={choice.value}
            id={`${id}-${choice.value}`}
            name="a"
            value={choice.value}
            title={choice.title}
            description={choice.description}
            defaultChecked={known && choice.value === initialChoice}
            required
          />
        ))}
      </fieldset>
      {withResults ? (
        <fieldset className="fh-choices">
          <legend className="fh-label">
            What came of it? <span className="fh-muted">Tick any</span>
          </legend>
          {Object.entries(RESULT_LABELS).map(([value, label]) => (
            <OptionCard key={value} type="checkbox" id={`${id}-result-${value}`} name="results" value={value} title={label} />
          ))}
        </fieldset>
      ) : null}
      {email ? (
        <div className="fh-field fh-ifyes">
          <label className="fh-label" htmlFor={`${id}-email`}>
            {email.label}
          </label>
          <Input
            id={`${id}-email`}
            name={FIELDS.targetEmail}
            type="email"
            inputMode="email"
            defaultValue={email.initial ?? ""}
            placeholder="e.g. name@company.example"
            aria-describedby={emailError ? `${id}-email-error` : undefined}
          />
          {emailError ? (
            <p id={`${id}-email-error`} className="fh-hint fh-err" role="alert">
              {emailError}
            </p>
          ) : null}
          <p className="fh-hint">{email.hint}</p>
        </div>
      ) : null}
      {note !== null ? (
        <details className="fh-field" open={noteError ? true : undefined}>
          <summary className="fh-small">Edit the note before it goes on</summary>
          <Textarea name={FIELDS.note} maxLength={INTRO_LIMITS.noteLength} rows={6} defaultValue={note} className="mt-2" />
          {noteError ? <p className="fh-hint fh-err">{noteError}</p> : null}
        </details>
      ) : null}
      {withPrivateNote ? (
        <div className="fh-field hidden [.fh-decide:has(input[name=a][value=dont_know]:checked)_&]:block [.fh-decide:has(input[name=a][value=not_now]:checked)_&]:block">
          <label className="fh-label" htmlFor={`${id}-reason`}>
            A note for yourself (optional)
          </label>
          <Textarea id={`${id}-reason`} name="reason" rows={3} maxLength={INTRO_LIMITS.declineReasonLength} className="mt-2 min-h-0" />
          <p className="fh-hint">Private to you. The asker never sees it, and it’s never emailed.</p>
        </div>
      ) : null}
      <div className="fh-btn-row mt-3.5">
        <Button type="submit" width="block" disabled={isPending}>
          Send my answer
        </Button>
      </div>
      {hasConsentLine ? (
        <div className="mt-3">
          <ConsentLine />
        </div>
      ) : null}
      {after}
    </form>
  );
}
