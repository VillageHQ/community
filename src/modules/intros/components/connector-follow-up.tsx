"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Flag, HeartHandshake, Lock } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readFirstName } from "@/platform/design/avatar-identity";
import { formatDayMonth } from "@/platform/text/format-date";
import { INTRO_ACTIONS, INTRO_DECLINE_KINDS, INTRO_LIMITS, INTRO_STATES, type Intro, type IntroDeclineKind } from "@/modules/intros/contract";
import { composeForwardableBlurb, composeJoiningMessage } from "@/modules/intros/copy";
import { reportIntroNoteRequest } from "@/modules/intros/queries";

import { ConfirmAction } from "@/components/confirm-action";
import { ConsentLinkPanel } from "./consent-link-panel";
import { useIntroTransition } from "./use-intro-actions";

type DeclineFormProps = { intro: Intro; kind: IntroDeclineKind; submitLabel: string; onCancel: () => void };

function DeclineForm({ intro, kind, submitLabel, onCancel }: DeclineFormProps) {
  const transition = useIntroTransition();
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const firstName = readFirstName(intro.requester.name);
  useEffect(() => field.current?.focus(), []);

  return (
    <form
      className="grid gap-3 rounded-field bg-muted p-4"
      onSubmit={(event) => {
        event.preventDefault();
        transition.mutate({ introId: intro.id, action: INTRO_ACTIONS.decline, reason: reason.trim() || null, kind });
      }}
    >
      <p className="type-note text-foreground-soft">
        No need to explain. {firstName} sees that this intro isn&apos;t happening, not who answered.
      </p>
      <div className="grid gap-2">
        <Label htmlFor={reasonId}>A note for yourself (optional)</Label>
        <Textarea
          ref={field}
          id={reasonId}
          rows={3}
          maxLength={INTRO_LIMITS.declineReasonLength}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="type-small text-muted-foreground">Private to you. {firstName} never sees this, and it&apos;s never emailed.</p>
      </div>
      <FormError message={transition.error?.message ?? null} />
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" size="lg" variant="outline" disabled={transition.isPending} className="sm:flex-1">
          {transition.isPending ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" size="lg" variant="quiet" onClick={onCancel}>
          Never mind
        </Button>
      </div>
    </form>
  );
}

function AskingTargetActions({ intro }: { intro: Intro }) {
  const [isBackingOut, setIsBackingOut] = useState(false);
  const targetFirst = readFirstName(intro.target.name);

  return (
    <div className="grid gap-3">
      <ConsentLinkPanel intro={intro} />
      <p className="type-small text-muted-foreground">
        We&apos;ll show {targetFirst}&apos;s answer here. If {targetFirst} doesn&apos;t answer, this closes on {formatDayMonth(intro.expiresAt)}.
      </p>
      {isBackingOut ? (
        <DeclineForm intro={intro} kind={INTRO_DECLINE_KINDS.notThisTime} submitLabel="Close this intro request" onCancel={() => setIsBackingOut(false)} />
      ) : (
        <Button type="button" variant="quiet" onClick={() => setIsBackingOut(true)}>
          I can&apos;t make this intro after all
        </Button>
      )}
    </div>
  );
}

function TargetAgreedActions({ intro }: { intro: Intro }) {
  const transition = useIntroTransition();
  const joiningMessage = composeJoiningMessage(intro);
  const targetFirst = readFirstName(intro.target.name);
  const requesterFirst = readFirstName(intro.requester.name);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 rounded-field bg-accent p-4">
        <h3 className="type-h3 flex items-center gap-2">
          <HeartHandshake aria-hidden="true" className="size-5 shrink-0 text-brand-emphasis" />
          {targetFirst} said yes. Now join them.
        </h3>
        <p className="type-note text-foreground-soft">Send this one message to {targetFirst} and {requesterFirst} together, however you normally reach them.</p>
        <p className="type-body rounded-field bg-card p-4 wrap-anywhere whitespace-pre-wrap text-foreground">{joiningMessage}</p>
        <div>
          <CopyButton text={joiningMessage} label="Copy the message" />
        </div>
      </div>
      <FormError message={transition.error?.message ?? null} />
      <Button
        type="button"
        size="hero"
        disabled={transition.isPending}
        onClick={() => transition.mutate({ introId: intro.id, action: INTRO_ACTIONS.complete })}
      >
        <Check aria-hidden="true" />
        {transition.isPending ? "Saving…" : "Mark as introduced"}
      </Button>
      <p className="type-small text-muted-foreground">
        Tap this once you&apos;ve sent it. If you don&apos;t get to it by {formatDayMonth(intro.expiresAt)}, this closes on its own and {requesterFirst} sees that it closed.
      </p>
    </div>
  );
}

function AcceptedActions({ intro }: { intro: Intro }) {
  const transition = useIntroTransition();
  const blurb = composeForwardableBlurb(intro);
  const targetFirst = readFirstName(intro.target.name);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 rounded-field bg-accent p-4">
        <h3 className="type-h3 flex items-center gap-2">
          <HeartHandshake aria-hidden="true" className="size-5 shrink-0 text-brand-emphasis" />
          Now send this to {targetFirst}
        </h3>
        <p className="type-note flex gap-2.5 text-foreground-soft">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            This community doesn&apos;t have {targetFirst}&apos;s email, and it won&apos;t contact {targetFirst}. You send this yourself, however you normally
            reach them.
          </span>
        </p>
        <p className="type-body rounded-field bg-card p-4 wrap-anywhere whitespace-pre-wrap text-foreground">{blurb}</p>
        <div>
          <CopyButton text={blurb} label="Copy the note" />
        </div>
      </div>
      <FormError message={transition.error?.message ?? null} />
      <Button
        type="button"
        size="hero"
        disabled={transition.isPending}
        onClick={() => transition.mutate({ introId: intro.id, action: INTRO_ACTIONS.complete })}
      >
        <Check aria-hidden="true" />
        {transition.isPending ? "Saving…" : "Mark as introduced"}
      </Button>
      <p className="type-small text-muted-foreground">
        Tap this once you&apos;ve made the intro. No rush. If you don&apos;t get to it by {formatDayMonth(intro.expiresAt)}, the intro request closes on its own and {readFirstName(intro.requester.name)} sees that it closed.
      </p>
    </div>
  );
}

// Community's "Report this note" (no Founderhall part), with its confirmation: admins read the note only then.
export function ReportNote({ intro }: { intro: Intro }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const reportButton = useRef<HTMLButtonElement>(null);
  const report = useMutation({ mutationFn: reportIntroNoteRequest, onSuccess: () => setIsConfirming(false) });
  if (report.data) {
    return (
      <p role="status" className="type-small text-foreground-soft">
        {report.data.message}
      </p>
    );
  }
  if (isConfirming) {
    return (
      <ConfirmAction
        message="Report this note? It's saved for this community's admins. They'll see a copy of the note, who wrote it and that you reported it, and nothing else about this intro request."
        confirmLabel="Report"
        pendingLabel="Reporting…"
        cancelLabel="Keep it"
        isPending={report.isPending}
        errorMessage={report.error?.message ?? null}
        onCancel={() => {
          setIsConfirming(false);
          requestAnimationFrame(() => reportButton.current?.focus());
        }}
        onConfirm={() => report.mutate(intro.id)}
      />
    );
  }
  return (
    <div>
      <Button ref={reportButton} type="button" variant="quiet" size="sm" onClick={() => setIsConfirming(true)}>
        <Flag aria-hidden="true" />
        Report this note
      </Button>
    </div>
  );
}

// Community's own follow-ups after the connector's yes (no Founderhall screen): share the person's link by hand when the
// community sends no email, or join them by hand when the person said yes without an address.
export function ConnectorFollowUp({ intro }: { intro: Intro }) {
  if (intro.state === INTRO_STATES.askingTarget) return <AskingTargetActions intro={intro} />;
  if (intro.state === INTRO_STATES.targetAgreed) return <TargetAgreedActions intro={intro} />;
  if (intro.state === INTRO_STATES.accepted) return <AcceptedActions intro={intro} />;
  return null;
}
