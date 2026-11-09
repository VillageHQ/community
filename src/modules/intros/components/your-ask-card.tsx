"use client";

import { Info, Lock, Undo2 } from "lucide-react";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { readFirstName } from "@/platform/design/avatar-identity";
import { formatShortDate } from "@/platform/text/format-date";
import { INTRO_ACTIONS, INTRO_STATES, type Intro, type RequesterIntroState, REQUESTER_STATES } from "@/modules/intros/contract";
import { readConsentPromise, readIntroPromise } from "@/modules/intros/copy";

import { ConfirmAction } from "@/components/confirm-action";
import {
  IntroCardFrame,
  IntroMessageButton,
  IntroNote,
  IntroPersonRow,
  IntroReason,
  IntroStateTag,
  IntroTimeline,
  readIntroLinkLabel,
  type HeadingLevel,
} from "./intro-parts";
import { OtherPaths } from "./other-paths";
import { OutcomePrompt } from "./outcome-prompt";
import { useIntroTransition } from "./use-intro-actions";

function WithdrawAction({ intro }: { intro: Intro }) {
  const transition = useIntroTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const introducerFirst = readFirstName(intro.introducer.name);

  if (isConfirming) {
    return (
      <ConfirmAction
        message={`Withdraw this intro request? ${introducerFirst} won't need to answer it any more.`}
        confirmLabel="Withdraw my intro request"
        pendingLabel="Withdrawing…"
        cancelLabel="Keep it"
        isPending={transition.isPending}
        errorMessage={transition.error?.message ?? null}
        onConfirm={() => transition.mutate({ introId: intro.id, action: INTRO_ACTIONS.withdraw })}
        onCancel={() => setIsConfirming(false)}
      />
    );
  }
  return (
    <>
      <FormError message={transition.error?.message ?? null} />
      <Button type="button" variant="quiet" size="default" className="w-full" onClick={() => setIsConfirming(true)}>
        <Undo2 aria-hidden="true" />
        Withdraw my intro request
      </Button>
    </>
  );
}

const FOLLOW_UP_STATES: ReadonlySet<RequesterIntroState> = new Set([INTRO_STATES.accepted, INTRO_STATES.targetAgreed, INTRO_STATES.completed]);

function readStatusNote({ state, introducer, target, expiresAt, acceptedAt, targetAgreedAt }: Intro) {
  const introducerFirst = readFirstName(introducer.name);
  const targetFirst = readFirstName(target.name);
  const hasYes = acceptedAt !== null || targetAgreedAt !== null;
  const notes: Record<RequesterIntroState, string> = {
    [INTRO_STATES.requested]: `${readIntroPromise(introducer.name, target.name)} ${readConsentPromise(target.name)} If nothing happens, this closes by itself around ${formatShortDate(expiresAt)}.`,
    [INTRO_STATES.accepted]: `Good news. ${introducerFirst} will reach out to ${targetFirst} themselves. This community doesn't contact ${targetFirst}.`,
    [INTRO_STATES.targetAgreed]: `Good news. ${targetFirst} said yes. ${introducerFirst} will connect you both with one message.`,
    [INTRO_STATES.completed]: targetAgreedAt
      ? `You're connected. ${targetFirst} said yes, and the intro is made. If you don't hear back, follow up with ${introducerFirst}.`
      : `${introducerFirst} says the intro is made. ${targetFirst} may get in touch, or you can follow up with ${introducerFirst}.`,
    [INTRO_STATES.declined]: "This intro isn't happening this time. That's completely normal, and we don't share who answered. Someone else may be able to help.",
    [INTRO_STATES.withdrawn]: "You withdrew this intro request, so it's closed for everyone.",
    [INTRO_STATES.expired]: hasYes
      ? `${targetAgreedAt ? targetFirst : introducerFirst} said yes, but this closed before the intro was marked as made. A quick message to ${introducerFirst} can sort it out.`
      : "This intro request closed without a yes. That's completely normal. Someone else may be able to help.",
  };
  return notes[REQUESTER_STATES[state]];
}

function hasNoYes({ state, acceptedAt, targetAgreedAt }: Intro) {
  return (state === INTRO_STATES.declined || state === INTRO_STATES.expired) && !acceptedAt && !targetAgreedAt;
}

type YourAskCardProps = { intro: Intro; headingLevel?: HeadingLevel };

export function YourAskCard({ intro, headingLevel: Heading = "h3" }: YourAskCardProps) {
  const { introducer, target, note, reason, hasUpdate } = intro;
  const state = REQUESTER_STATES[intro.state];
  const StatusIcon = state === INTRO_STATES.requested ? Lock : Info;

  return (
    <IntroCardFrame id={intro.id} label={readIntroLinkLabel(intro)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <IntroStateTag state={state} />
        {hasUpdate ? <Tag tone="accent">New</Tag> : null}
      </div>
      <Heading className="type-h2 wrap-anywhere">
        Your intro to {target.name}
        {target.headline ? <span className="type-small mt-0.5 block font-medium text-foreground-soft">{target.headline}</span> : null}
      </Heading>
      <IntroPersonRow person={introducer} line={introducer.headline} />
      <IntroReason reason={reason} />
      <p className="type-note flex gap-2.5 rounded-field bg-accent p-4 text-accent-foreground">
        <StatusIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{readStatusNote(intro)}</span>
      </p>
      <IntroTimeline intro={intro} />
      <IntroNote label="Your note" note={note} />
      {intro.isOutcomeDue ? <OutcomePrompt intro={intro} /> : null}
      {hasNoYes(intro) ? <OtherPaths intro={intro} /> : null}
      {FOLLOW_UP_STATES.has(state) ? <IntroMessageButton person={introducer} isPrimary /> : null}
      {state === INTRO_STATES.requested ? <WithdrawAction intro={intro} /> : null}
      {FOLLOW_UP_STATES.has(state) || hasNoYes(intro) ? null : <IntroMessageButton person={introducer} isPrimary={false} />}
    </IntroCardFrame>
  );
}
