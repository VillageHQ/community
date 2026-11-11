"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { useFlash } from "@/components/flash";
import { Button, ButtonRow } from "@/components/ui/button";
import { OptionCard } from "@/components/ui/checkbox-card";
import { Note } from "@/components/ui/note";
import { SetRow } from "@/components/ui/rows";
import { Switch } from "@/components/ui/switch";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { postRequest } from "@/platform/http/post-request";
import { WELCOME_DONE_FLASH, welcomeDoneSchema, type WelcomePrivacyBody } from "@/shell/welcome-steps";

const FALLBACK_ERROR_MESSAGE = "We couldn't save that. Try again.";

// "Northwind Founders’ admins", "Harbor Ventures’ admins", "Acme’s admins".
function possessive(name: string) {
  return name.endsWith("s") ? `${name}’` : `${name}’s`;
}

type PrivacyFormProps = {
  communityName: string;
  initial: { isHidden: boolean; acceptsIntroAsks: boolean; allowsLookup: boolean };
  isIntrosOn: boolean;
  isLookupOn: boolean;
};

// Founderhall's step 2 form: who sees you (two option cards), two switch rows, the consent note, Done and Back.
export function PrivacyForm({ communityName, initial, isIntrosOn, isLookupOn }: PrivacyFormProps) {
  const router = useRouter();
  const flash = useFlash();
  const [isHidden, setIsHidden] = useState(initial.isHidden);
  const [acceptsIntroAsks, setAcceptsIntroAsks] = useState(initial.acceptsIntroAsks);
  const [allowsLookup, setAllowsLookup] = useState(initial.allowsLookup);
  const [errorMessage, formAction, isPending] = useActionState(async (): Promise<string | null> => {
    const body: WelcomePrivacyBody = {
      isHidden,
      ...(isIntrosOn ? { acceptsIntroAsks } : {}),
      ...(isLookupOn ? { allowsLookup } : {}),
    };
    try {
      const { next } = await postRequest(API_ROUTES.onboardingPrivacy, body, welcomeDoneSchema, FALLBACK_ERROR_MESSAGE);
      if (next === ROUTES.members) flash(WELCOME_DONE_FLASH, { on: next });
      router.push(next);
      router.refresh();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE;
    }
  }, null);

  return (
    <form action={formAction} className="fh-section">
      {errorMessage ? (
        <Note kind="needs" icon={null} role="alert" className="mb-3">
          {errorMessage}
        </Note>
      ) : null}
      <p className="fh-label">Show me in the directory to</p>
      <OptionCard
        id="visibility-all"
        name="visibility"
        value="all"
        checked={!isHidden}
        onChange={() => setIsHidden(false)}
        title={`Everyone in ${communityName}`}
        description="Members see your profile, never your email address"
      />
      <OptionCard id="visibility-none" name="visibility" value="none" checked={isHidden} onChange={() => setIsHidden(true)} title="Nobody" description="You can still use the directory" />
      <div className="mt-2.5">
        {isIntrosOn ? (
          <SetRow
            htmlFor="accepts-asks"
            label="Let members ask me for intros"
            hint="You approve each one."
            control={<Switch id="accepts-asks" checked={acceptsIntroAsks} onCheckedChange={setAcceptsIntroAsks} />}
          />
        ) : null}
        {isLookupOn ? (
          <SetRow
            htmlFor="lookup-consent"
            label="Fill in my profile from public profiles. You can switch this off any time."
            hint="Your role, company, city and past roles, looked up by your email. Your own words always win; you can hide any line. Your data has the record."
            control={<Switch id="lookup-consent" checked={allowsLookup} onCheckedChange={setAllowsLookup} />}
          />
        ) : null}
      </div>
      <Note icon={ShieldCheck} className="mt-3.5">
        Nobody is introduced without saying yes. {possessive(communityName)} admins can’t read your messages in the portal.
      </Note>
      <ButtonRow className="mt-[18px]">
        <Button type="submit" disabled={isPending}>
          Done
        </Button>
        <Button asChild variant="quiet">
          <a href={ROUTES.welcome}>Back</a>
        </Button>
      </ButtonRow>
    </form>
  );
}
