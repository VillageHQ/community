"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, ExternalLink, Flag, HeartHandshake, Lock, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readFirstName } from "@/platform/design/avatar-identity";
import { formatShortDate } from "@/platform/text/format-date";
import { INTRO_ACTIONS, INTRO_LIMITS, INTRO_STATES, type Intro } from "@/lib/intros/intro-api";
import { composeForwardableBlurb } from "@/lib/intros/intro-copy";
import { reportIntroNoteRequest } from "@/lib/intros/intro-queries";
import { toLinkedinUrl } from "@/modules/members/contract-linkedin";

import {
  IntroCardFrame,
  IntroMessageButton,
  IntroNote,
  IntroPersonRow,
  IntroReason,
  IntroStateTag,
  readIntroLinkLabel,
  type HeadingLevel,
} from "./intro-parts";
import { ConfirmAction } from "@/components/confirm-action";
import { useIntroTransition } from "./use-intro-actions";

function TargetLink({ intro }: { intro: Intro }) {
  const { name, linkedinSlug } = intro.target;
  return (
    <a
      href={toLinkedinUrl(linkedinSlug)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-bold text-brand-emphasis underline underline-offset-3 hover:no-underline"
    >
      <span className="wrap-anywhere">{name}</span>
      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only"> on LinkedIn (opens in a new tab)</span>
    </a>
  );
}

function DeclineForm({ intro, onCancel }: { intro: Intro; onCancel: () => void }) {
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
        transition.mutate({ introId: intro.id, action: INTRO_ACTIONS.decline, reason: reason.trim() || null });
      }}
    >
      <p className="type-note text-foreground-soft">
        No need to explain. {firstName} will see a kind note that you can&apos;t help this time, and {readFirstName(intro.target.name)} hears nothing.
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
          {transition.isPending ? "Passing…" : "Pass on this one"}
        </Button>
        <Button type="button" size="lg" variant="quiet" onClick={onCancel}>
          Never mind
        </Button>
      </div>
    </form>
  );
}

function RequestedActions({ intro }: { intro: Intro }) {
  const transition = useIntroTransition();
  const [isDeclining, setIsDeclining] = useState(false);
  const declineButton = useRef<HTMLButtonElement>(null);
  const firstName = readFirstName(intro.requester.name);

  if (isDeclining) {
    return (
      <DeclineForm
        intro={intro}
        onCancel={() => {
          setIsDeclining(false);
          requestAnimationFrame(() => declineButton.current?.focus());
        }}
      />
    );
  }

  return (
    <>
      <FormError message={transition.error?.message ?? null} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          size="hero"
          disabled={transition.isPending}
          aria-label={`Accept ${firstName}'s ask`}
          onClick={() => transition.mutate({ introId: intro.id, action: INTRO_ACTIONS.accept })}
        >
          <Check aria-hidden="true" />
          {transition.isPending ? "Saving…" : "Accept"}
        </Button>
        <Button
          ref={declineButton}
          type="button"
          size="hero"
          variant="outline"
          disabled={transition.isPending}
          aria-label={`Decline ${firstName}'s ask`}
          onClick={() => setIsDeclining(true)}
        >
          <X aria-hidden="true" />
          Decline
        </Button>
      </div>
      <p className="type-small text-muted-foreground">
        Say no as freely as yes. If you do nothing, this ask closes on {formatShortDate(intro.expiresAt)}.
      </p>
    </>
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
        Tap this once you&apos;ve made the intro. No rush. If you don&apos;t get to it by {formatShortDate(intro.expiresAt)}, the ask closes on its own and {readFirstName(intro.requester.name)} sees that it closed.
      </p>
    </div>
  );
}

function readClosedNote({ state, requester, target, declineReason }: Intro) {
  const firstName = readFirstName(requester.name);
  const notes: Partial<Record<Intro["state"], string>> = {
    [INTRO_STATES.completed]: `Thanks for connecting ${firstName} with ${readFirstName(target.name)}.`,
    [INTRO_STATES.declined]: declineReason ? `You passed on this one. Your private note: "${declineReason}"` : `You passed on this one. ${firstName} got a kind note.`,
    [INTRO_STATES.withdrawn]: `${firstName} withdrew this ask. Nothing more to do.`,
    [INTRO_STATES.expired]: "This ask closed by itself. Nothing more to do.",
  };
  return notes[state] ?? null;
}

function ReportNote({ intro }: { intro: Intro }) {
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
        message="Report this note? It's saved for this community's admins. They'll see a copy of the note, who wrote it and that you reported it, and nothing else about this ask."
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

type AskForYouCardProps = { intro: Intro; headingLevel?: HeadingLevel };

export function AskForYouCard({ intro, headingLevel: Heading = "h3" }: AskForYouCardProps) {
  const { requester, state, note, reason } = intro;
  const firstName = readFirstName(requester.name);
  const closedNote = readClosedNote(intro);
  const isRequested = state === INTRO_STATES.requested;
  const isAccepted = state === INTRO_STATES.accepted;

  return (
    <IntroCardFrame id={intro.id} label={readIntroLinkLabel(intro)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <IntroPersonRow person={requester} line={requester.headline} />
        <IntroStateTag state={state} />
      </div>
      <Heading className="type-h2 wrap-anywhere">
        {firstName} would like an intro to <TargetLink intro={intro} />
      </Heading>
      <IntroNote label={`${firstName}'s note to you`} note={note} />
      <ReportNote intro={intro} />
      <div>
        <p className="type-micro mb-1.5 font-bold text-foreground-soft">Why they asked you</p>
        <IntroReason reason={reason} />
      </div>
      {isRequested ? <RequestedActions intro={intro} /> : null}
      {isAccepted ? <AcceptedActions intro={intro} /> : null}
      {closedNote ? <p className="type-note rounded-field bg-muted p-4 wrap-anywhere text-foreground-soft">{closedNote}</p> : null}
      <IntroMessageButton person={requester} isPrimary={false} />
    </IntroCardFrame>
  );
}
