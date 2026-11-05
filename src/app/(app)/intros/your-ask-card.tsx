"use client";

import { Info, Lock, Undo2 } from "lucide-react";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { readFirstName } from "@/lib/design/avatar-identity";
import { formatShortDate } from "@/lib/format-date";
import { INTRO_ACTIONS, INTRO_STATES, type Intro } from "@/lib/intros/intro-api";
import { readIntroPromise } from "@/lib/intros/intro-copy";

import { ConfirmAction } from "../messages/confirm-action";
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
import { useIntroTransition } from "./use-intro-actions";

function WithdrawAction({ intro }: { intro: Intro }) {
  const transition = useIntroTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const introducerFirst = readFirstName(intro.introducer.name);

  if (isConfirming) {
    return (
      <ConfirmAction
        message={`Withdraw this ask? ${introducerFirst} won't need to answer it any more.`}
        confirmLabel="Withdraw my ask"
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
        Withdraw my ask
      </Button>
    </>
  );
}

const FOLLOW_UP_STATES: ReadonlySet<Intro["state"]> = new Set([INTRO_STATES.accepted, INTRO_STATES.completed]);

function readStatusNote({ state, introducer, target, expiresAt, acceptedAt }: Intro) {
  const introducerFirst = readFirstName(introducer.name);
  const targetFirst = readFirstName(target.name);
  const notes: Record<Intro["state"], string> = {
    [INTRO_STATES.requested]: `${readIntroPromise(introducer.name, target.name)} This ask closes on ${formatShortDate(expiresAt)} if nothing happens.`,
    [INTRO_STATES.accepted]: `Good news. ${introducerFirst} will reach out to ${targetFirst} themselves. This community doesn't contact ${targetFirst}.`,
    [INTRO_STATES.completed]: `${introducerFirst} says the intro is made. ${targetFirst} may get in touch, or you can follow up with ${introducerFirst}.`,
    [INTRO_STATES.declined]: `${introducerFirst} can't help with this one. That's completely normal, and ${targetFirst} heard nothing about it. Someone else may be able to help.`,
    [INTRO_STATES.withdrawn]: `You withdrew this ask. ${targetFirst} heard nothing about it.`,
    [INTRO_STATES.expired]: acceptedAt
      ? `${introducerFirst} said yes, but this closed before the intro was marked as made. A quick message can sort it out.`
      : `This ask closed without an answer. ${targetFirst} heard nothing about it. You can ask again from Network.`,
  };
  return notes[state];
}

type YourAskCardProps = { intro: Intro; headingLevel?: HeadingLevel };

export function YourAskCard({ intro, headingLevel: Heading = "h3" }: YourAskCardProps) {
  const { introducer, target, state, note, reason, hasUpdate } = intro;
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
      {FOLLOW_UP_STATES.has(state) ? <IntroMessageButton person={introducer} isPrimary /> : null}
      {state === INTRO_STATES.requested ? <WithdrawAction intro={intro} /> : null}
      {FOLLOW_UP_STATES.has(state) ? null : <IntroMessageButton person={introducer} isPrimary={false} />}
    </IntroCardFrame>
  );
}
