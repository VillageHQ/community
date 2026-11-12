"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useFlash } from "@/components/flash";
import { Avatar } from "@/components/ui/avatar";
import { FormError } from "@/components/form-error";
import { readFirstName } from "@/platform/design/avatar-identity";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

import { CONSENT_ANSWERS, targetMemberAnswerSchema, type IntroForTarget } from "../contract";

type Answer = typeof CONSENT_ANSWERS.yes | typeof CONSENT_ANSWERS.noThanks;

// INTRO-06: an intro waiting on a member because they are the person asked for. The emailed page's words (Founderhall's
// decisionPage), answered in place: "Yes, introduce us" or "No thanks". Used on Today and Your intros.
export function TargetMemberAsk({ intro, ago }: { intro: IntroForTarget; ago: string }) {
  const router = useRouter();
  const flash = useFlash();
  const [done, setDone] = useState<string | null>(null);
  const askerFirst = readFirstName(intro.requester.name);
  const answer = useMutation({
    mutationFn: (choice: Answer) => postRequest(API_ROUTES.introTargetAnswer, { introId: intro.id, answer: choice }, targetMemberAnswerSchema),
    onSuccess: (saved) => {
      const message =
        saved.isRepeat
          ? "Already answered. There’s nothing more to do."
          : saved.answer === CONSENT_ANSWERS.yes
            ? `You said yes. Check your email: we’ll introduce you and ${askerFirst} with one message.`
            : "Thanks for answering. Nobody is told why, and nothing more is sent about this.";
      // The card leaves the page on refresh (nothing waits on them any more), so the answer stays as the page's flash.
      setDone(message);
      flash(message);
      router.refresh();
    },
  });
  return (
    <article className="fh-titem" aria-label={`${intro.introducerName} would like to introduce you to ${intro.requester.name}`}>
      <div className="fh-ph">
        <Avatar stableId={intro.requester.id} name={intro.requester.name} imageUrl={intro.requester.avatarUrl} sizePx={28} />
        <div>
          <b>{`${intro.introducerName} would like to introduce you to ${intro.requester.name}`}</b>
          <span>{[intro.requester.headline, `Asked ${ago}. ${askerFirst} hears nothing unless you say yes.`].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
      {intro.note ? <div className="fh-quote fh-notetext">{intro.note}</div> : null}
      {done ? (
        <p className="fh-small" role="status">
          {done}
        </p>
      ) : (
        <div className="fh-btn-row">
          <button type="button" className="fh-btn fh-btn-primary" disabled={answer.isPending} onClick={() => answer.mutate(CONSENT_ANSWERS.yes)}>
            Yes, introduce us
          </button>
          <button type="button" className="fh-btn fh-btn-quiet" disabled={answer.isPending} onClick={() => answer.mutate(CONSENT_ANSWERS.noThanks)}>
            No thanks
          </button>
        </div>
      )}
      <FormError message={answer.error?.message ?? null} />
    </article>
  );
}
