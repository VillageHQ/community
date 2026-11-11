"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, ExternalLink, Flag, HeartHandshake, Lock, UserRoundX, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readFirstName } from "@/platform/design/avatar-identity";
import { formatShortDate } from "@/platform/text/format-date";
import { INTRO_ACTIONS, INTRO_DECLINE_KINDS, INTRO_LIMITS, INTRO_STATES, type Intro, type IntroDeclineKind } from "@/modules/intros/contract";
import { composeForwardableBlurb, composeJoiningMessage } from "@/modules/intros/copy";
import { reportIntroNoteRequest } from "@/modules/intros/queries";
import { linkedinUrl } from "@villagehq/sdk";

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
import { ConsentLinkPanel } from "./consent-link-panel";
import { useIntroTransition } from "./use-intro-actions";

function TargetLink({ intro }: { intro: Intro }) {
  const { name, headline, linkedinSlug } = intro.target;
  if (!linkedinSlug) {
    return (
      <span className="font-bold wrap-anywhere text-foreground">
        {name}
        {intro.target.isNamed && headline ? <span className="font-normal text-foreground-soft"> at {headline}</span> : null}
      </span>
    );
  }
  return (
    <a
      href={linkedinUrl(linkedinSlug)}
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

const DECLINE_LABELS: Record<IntroDeclineKind, string> = {
  [INTRO_DECLINE_KINDS.notThisTime]: "Not this time",
  [INTRO_DECLINE_KINDS.doNotKnowThem]: "I don't know them well enough",
};

function RequestedActions({ intro }: { intro: Intro }) {
  const transition = useIntroTransition();
  const [declineKind, setDeclineKind] = useState<IntroDeclineKind | null>(null);
  const declineButton = useRef<HTMLButtonElement>(null);
  const targetFirst = readFirstName(intro.target.name);

  if (declineKind) {
    return (
      <DeclineForm
        intro={intro}
        kind={declineKind}
        submitLabel={DECLINE_LABELS[declineKind]}
        onCancel={() => {
          setDeclineKind(null);
          requestAnimationFrame(() => declineButton.current?.focus());
        }}
      />
    );
  }

  return (
    <>
      <FormError message={transition.error?.message ?? null} />
      <div className="grid gap-2">
        <Button
          type="button"
          size="hero"
          disabled={transition.isPending}
          className="w-full whitespace-normal"
          onClick={() => transition.mutate({ introId: intro.id, action: INTRO_ACTIONS.accept })}
        >
          <Check aria-hidden="true" />
          {transition.isPending ? "Saving…" : `Yes, I'll ask ${targetFirst}`}
        </Button>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            ref={declineButton}
            type="button"
            size="lg"
            variant="outline"
            disabled={transition.isPending}
            className="whitespace-normal"
            onClick={() => setDeclineKind(INTRO_DECLINE_KINDS.notThisTime)}
          >
            <X aria-hidden="true" />
            {DECLINE_LABELS[INTRO_DECLINE_KINDS.notThisTime]}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={transition.isPending}
            className="whitespace-normal"
            onClick={() => setDeclineKind(INTRO_DECLINE_KINDS.doNotKnowThem)}
          >
            <UserRoundX aria-hidden="true" />
            {DECLINE_LABELS[INTRO_DECLINE_KINDS.doNotKnowThem]}
          </Button>
        </div>
      </div>
      <p className="type-small text-muted-foreground">
        Say no as freely as yes. {targetFirst} hears nothing unless you say yes. If you do nothing, this intro request closes on {formatShortDate(intro.expiresAt)}.
      </p>
    </>
  );
}

function AskingTargetActions({ intro }: { intro: Intro }) {
  const [isBackingOut, setIsBackingOut] = useState(false);
  const targetFirst = readFirstName(intro.target.name);

  return (
    <div className="grid gap-3">
      <ConsentLinkPanel intro={intro} />
      <p className="type-small text-muted-foreground">
        We&apos;ll show {targetFirst}&apos;s answer here. If {targetFirst} doesn&apos;t answer, this closes on {formatShortDate(intro.expiresAt)}.
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
        Tap this once you&apos;ve sent it. If you don&apos;t get to it by {formatShortDate(intro.expiresAt)}, this closes on its own and {requesterFirst} sees that it closed.
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
        Tap this once you&apos;ve made the intro. No rush. If you don&apos;t get to it by {formatShortDate(intro.expiresAt)}, the intro request closes on its own and {readFirstName(intro.requester.name)} sees that it closed.
      </p>
    </div>
  );
}

function readClosedNote({ state, requester, target, declineReason }: Intro) {
  const firstName = readFirstName(requester.name);
  const targetFirst = readFirstName(target.name);
  const notes: Partial<Record<Intro["state"], string>> = {
    [INTRO_STATES.completed]: `Thanks for connecting ${firstName} with ${targetFirst}.`,
    [INTRO_STATES.declined]: declineReason ? `You passed on this one. Your private note: "${declineReason}"` : `You passed on this one. ${firstName} got a kind note.`,
    [INTRO_STATES.targetDeclined]: `${targetFirst} said no thanks. ${firstName} sees that this intro isn't happening, not who answered. Nothing more to do.`,
    [INTRO_STATES.withdrawn]: `${firstName} withdrew this intro request. Nothing more to do.`,
    [INTRO_STATES.expired]: "This intro request closed by itself. Nothing more to do.",
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

type AskForYouCardProps = { intro: Intro; headingLevel?: HeadingLevel };

export function AskForYouCard({ intro, headingLevel: Heading = "h3" }: AskForYouCardProps) {
  const { requester, state, note, reason } = intro;
  const firstName = readFirstName(requester.name);
  const closedNote = readClosedNote(intro);
  const isRequested = state === INTRO_STATES.requested;
  const isAccepted = state === INTRO_STATES.accepted;
  const isAskingTarget = state === INTRO_STATES.askingTarget;
  const isTargetAgreed = state === INTRO_STATES.targetAgreed;

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
      {isAskingTarget ? <AskingTargetActions intro={intro} /> : null}
      {isTargetAgreed ? <TargetAgreedActions intro={intro} /> : null}
      {closedNote ? <p className="type-note rounded-field bg-muted p-4 wrap-anywhere text-foreground-soft">{closedNote}</p> : null}
      <IntroMessageButton person={requester} isPrimary={false} />
    </IntroCardFrame>
  );
}
