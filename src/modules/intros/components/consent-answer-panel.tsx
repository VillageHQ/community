"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, CircleCheck, HandHeart, Hand, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { QueryProvider } from "@/components/query-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CONSENT_ANSWERS, type ConsentAnswer } from "@/modules/intros/contract";
import { answerConsentRequest } from "@/modules/intros/queries";
import { readFirstName } from "@/platform/design/avatar-identity";
import { formatShortDate } from "@/platform/text/format-date";

const REQUESTER_AVATAR_SIZE_PX = 56;

type OpenConsent = {
  requesterName: string;
  requesterHeadline: string | null;
  introducerName: string;
  targetName: string;
  note: string;
  closesAt: string;
  joinsByEmail: boolean;
};

type ConsentAnswerPanelProps = { token: string; communityName: string; consent: OpenConsent };

function readAnswerMessage(answer: ConsentAnswer, { requesterName, introducerName, joinsByEmail }: OpenConsent, communityName: string) {
  const requesterFirst = readFirstName(requesterName);
  const introducerFirst = readFirstName(introducerName);
  const messages: Record<ConsentAnswer, { title: string; description: string }> = {
    [CONSENT_ANSWERS.yes]: {
      title: "Thank you. You said yes.",
      description: joinsByEmail
        ? `We're emailing you and ${requesterFirst} now, so you can take it from there. That's the only email we'll send about this.`
        : `${introducerFirst} will connect you and ${requesterFirst} with one message.`,
    },
    [CONSENT_ANSWERS.noThanks]: {
      title: "Thanks for letting us know",
      description: `Nothing more happens. ${requesterFirst} hears that this intro isn't going ahead, not who answered. ${introducerFirst} sees your answer.`,
    },
    [CONSENT_ANSWERS.stopAllAsks]: {
      title: "You won't get any more intro requests",
      description: `${communityName} won't send you any more intro requests. ${requesterFirst} hears that this intro isn't going ahead, not who answered. ${introducerFirst} sees your answer.`,
    },
  };
  return messages[answer];
}

function AnsweredMessage({ answer, consent, communityName }: { answer: ConsentAnswer; consent: OpenConsent; communityName: string }) {
  const { title, description } = readAnswerMessage(answer, consent, communityName);
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div ref={heading} tabIndex={-1} role="status" className="flex min-h-[60dvh] items-center justify-center outline-none lg:min-h-[calc(100dvh-140px)]">
      <EmptyState headingLevel="h1" icon={answer === CONSENT_ANSWERS.yes ? CircleCheck : HandHeart} title={title} description={description} />
    </div>
  );
}

function StopAllAsks({ communityName, answer, isPending, errorMessage }: { communityName: string; answer: (choice: ConsentAnswer) => void; isPending: boolean; errorMessage: string | null }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const stopButton = useRef<HTMLButtonElement>(null);
  if (isConfirming) {
    return (
      <ConfirmAction
        message={`Stop all intro requests from ${communityName}? This says no thanks to this one too, and you can't undo it from here.`}
        confirmLabel="Stop all intro requests"
        pendingLabel="Stopping…"
        cancelLabel="Go back"
        isPending={isPending}
        errorMessage={errorMessage}
        onConfirm={() => answer(CONSENT_ANSWERS.stopAllAsks)}
        onCancel={() => {
          setIsConfirming(false);
          requestAnimationFrame(() => stopButton.current?.focus());
        }}
      />
    );
  }
  return (
    <div className="flex justify-center">
      <Button ref={stopButton} type="button" variant="quiet" size="sm" disabled={isPending} onClick={() => setIsConfirming(true)}>
        <Hand aria-hidden="true" />
        Stop all intro requests from {communityName}
      </Button>
    </div>
  );
}

function ConsentQuestion({ token, communityName, consent }: ConsentAnswerPanelProps) {
  const { requesterName, requesterHeadline, introducerName, targetName, note, closesAt, joinsByEmail } = consent;
  const requesterFirst = readFirstName(requesterName);
  const introducerFirst = readFirstName(introducerName);
  const answerMutation = useMutation({ mutationFn: (answer: ConsentAnswer) => answerConsentRequest({ token, answer }) });
  const [isStopFailure, setIsStopFailure] = useState(false);

  if (answerMutation.data) return <AnsweredMessage answer={answerMutation.data.answer} consent={consent} communityName={communityName} />;

  function answer(choice: ConsentAnswer) {
    setIsStopFailure(choice === CONSENT_ANSWERS.stopAllAsks);
    answerMutation.mutate(choice);
  }
  const errorMessage = answerMutation.error?.message ?? null;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h1 className="type-h1 lg:type-display wrap-anywhere">Would you like to meet {requesterFirst}?</h1>
        <p className="type-lead wrap-anywhere text-foreground-soft">
          Hi {readFirstName(targetName)}. {requesterName} asked {introducerName} for an intro to you, and {introducerFirst} wanted to check with you first. Nothing happens unless you say yes.
        </p>
      </div>

      <section aria-label={`What ${requesterFirst} wrote`} className="grid gap-4 rounded-panel bg-card p-5 shadow-panel sm:p-7">
        <div className="flex items-center gap-3.5">
          <Avatar stableId={requesterName} name={requesterName} sizePx={REQUESTER_AVATAR_SIZE_PX} />
          <div className="min-w-0">
            <p className="type-h3 wrap-anywhere">{requesterName}</p>
            {requesterHeadline ? <p className="type-small wrap-anywhere text-foreground-soft">{requesterHeadline}</p> : null}
          </div>
        </div>
        <div className="rounded-field bg-muted p-4">
          <p className="type-micro mb-1.5 font-bold text-foreground-soft">What {requesterFirst} wrote</p>
          <p className="type-body wrap-anywhere whitespace-pre-wrap text-foreground">{note}</p>
        </div>
      </section>

      <div className="grid gap-3">
        {isStopFailure ? null : <FormError message={errorMessage} />}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Button type="button" size="hero" disabled={answerMutation.isPending} onClick={() => answer(CONSENT_ANSWERS.yes)}>
            <Check aria-hidden="true" />
            Yes, introduce us
          </Button>
          <Button type="button" size="hero" variant="outline" disabled={answerMutation.isPending} onClick={() => answer(CONSENT_ANSWERS.noThanks)}>
            <X aria-hidden="true" />
            No thanks
          </Button>
        </div>
        <ul className="type-note grid gap-1.5 text-foreground-soft">
          <li>
            If you say yes,{" "}
            {joinsByEmail ? `we email you and ${requesterFirst} once, so you can take it from there.` : `${introducerFirst} connects you with one message.`}
          </li>
          <li>
            If you say no, {requesterFirst} isn&apos;t told who answered. {introducerFirst} sees your answer.
          </li>
        </ul>
      </div>

      <StopAllAsks communityName={communityName} answer={answer} isPending={answerMutation.isPending} errorMessage={isStopFailure ? errorMessage : null} />

      <p className="type-small text-center text-muted-foreground">
        You don&apos;t need an account. This private link works once and closes on {formatShortDate(closesAt)}.
      </p>
    </div>
  );
}

export function ConsentAnswerPanel(props: ConsentAnswerPanelProps) {
  return (
    <QueryProvider>
      <ConsentQuestion {...props} />
    </QueryProvider>
  );
}
