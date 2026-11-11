"use client";

import { useMutation } from "@tanstack/react-query";
import { EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useFlash } from "@/components/flash";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { OptionCard } from "@/components/ui/checkbox-card";
import { SetRow } from "@/components/ui/rows";
import { Switch } from "@/components/ui/switch";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import type { PrivacyBody } from "@/modules/members/contract-privacy";
import { toPossessive } from "@/modules/members/rules-words";

const VISIBILITY = { all: "all", none: "none" } as const;
const ASKS_SWITCH_ID = "privacy-accepts-asks";

function savePrivacy(body: PrivacyBody) {
  return postRequest(API_ROUTES.profilePrivacy, body, acknowledgedResponseSchema);
}

type PrivacySheetProps = {
  communityName: string;
  isHidden: boolean;
  // Null while intros are off: the intro asks row is not offered. Never answered counts as yes.
  acceptsIntroAsks: boolean | null;
};

// Founderhall's Privacy sheet on My profile: who sees me in the directory, intro asks, one Save privacy.
export function PrivacySheet({ communityName, isHidden, acceptsIntroAsks }: PrivacySheetProps) {
  const router = useRouter();
  const flash = useFlash();
  const [visibility, setVisibility] = useState<string>(isHidden ? VISIBILITY.none : VISIBILITY.all);
  const [acceptsAsks, setAcceptsAsks] = useState(acceptsIntroAsks ?? true);
  const save = useMutation({
    mutationFn: savePrivacy,
    onSuccess: () => {
      flash("Privacy settings saved.");
      router.refresh();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // "Accept intro asks" is a consent choice with its own date: it is saved only when the member changes it.
    const asksChanged = acceptsIntroAsks !== null && acceptsAsks !== acceptsIntroAsks;
    save.mutate({ isHidden: visibility === VISIBILITY.none, ...(asksChanged ? { acceptsIntroAsks: acceptsAsks } : {}) });
  }

  return (
    <section className="fh-sheet" id="privacy" aria-labelledby="privacy-title">
      <h2 id="privacy-title" className="fh-h3 flex items-center gap-1.5">
        <EyeOff aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} /> Privacy
      </h2>
      <form onSubmit={submit}>
        <p className="fh-label mt-3">Show me in the directory to</p>
        <div className="mt-2">
          <OptionCard
            id="privacy-visibility-all"
            name="visibility"
            value={VISIBILITY.all}
            checked={visibility === VISIBILITY.all}
            onChange={() => setVisibility(VISIBILITY.all)}
            title={`Everyone in ${communityName}`}
            description="Members see your profile, never your email address"
          />
          <OptionCard
            id="privacy-visibility-none"
            name="visibility"
            value={VISIBILITY.none}
            checked={visibility === VISIBILITY.none}
            onChange={() => setVisibility(VISIBILITY.none)}
            title="Nobody"
            description="You can still use the directory. Admins still see you."
          />
        </div>
        {acceptsIntroAsks === null ? null : (
          <SetRow
            htmlFor={ASKS_SWITCH_ID}
            label="Let members ask me for intros"
            hint="You approve each one. Nobody is introduced without saying yes."
            control={<Switch id={ASKS_SWITCH_ID} checked={acceptsAsks} onCheckedChange={setAcceptsAsks} />}
          />
        )}
        <FormError message={save.error?.message ?? null} />
        <div className="fh-btn-row mt-3">
          <Button type="submit" variant="primary" size="sm" disabled={save.isPending}>
            Save privacy
          </Button>
        </div>
      </form>
      <p className="fh-small fh-muted mt-2.5">
        {toPossessive(communityName)} admins can’t read your messages in the portal. <Link href={ROUTES.emailSettings}>Email settings</Link> ·{" "}
        <Link href={ROUTES.yourData}>Your data</Link>
      </p>
    </section>
  );
}
