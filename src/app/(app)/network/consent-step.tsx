"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CircleAlert, DoorOpen, Mail, UsersRound, Waypoints } from "lucide-react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { CheckboxCard } from "@/components/ui/checkbox-card";
import { readFirstName } from "@/lib/design/avatar-identity";
import { API_ROUTES, ROUTES } from "@/lib/routes";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

import { JOIN_STEPS, JoinSteps } from "./join-steps";
import { JoinLayout } from "./join-layout";
import { NotNowAction } from "./not-now-action";
import { OnboardingSteps, ONBOARDING_PILLS } from "./onboarding-steps";
import { readSharingSentence, type WelcomeContext } from "./welcome-context";

const CONSENT_FIELD_ID = "sharing-consent";

const DEAL_NOTES = [
  {
    icon: Mail,
    text: "Your email address goes to Village, the company that runs network search for this community.",
  },
  {
    icon: DoorOpen,
    text: "You can leave the group from this page. That stops sharing with the group, but people who already saw your contacts can't unsee them.",
  },
  {
    icon: CircleAlert,
    text: "An admin removing you from this site doesn't yet remove you from the Village group. Leave the group first if you plan to go.",
  },
];

function recordConsent(formData: FormData) {
  return postNetworkRequest(
    API_ROUTES.networkConsent,
    { acknowledged: formData.get(CONSENT_FIELD_ID) === "on" },
    acknowledgedResponseSchema,
  );
}

function reopenNetworkPage() {
  window.location.assign(ROUTES.network);
}

export function ConsentStep({ welcome }: { welcome: WelcomeContext }) {
  const consentMutation = useMutation({ mutationFn: recordConsent, onSuccess: reopenNetworkPage });

  return (
    <JoinLayout welcome={welcome}>
      {welcome.isOnboarding ? <OnboardingSteps current={ONBOARDING_PILLS.network} /> : <JoinSteps current={JOIN_STEPS.share} />}
      <h1 className="type-h1 lg:type-display">Welcome in, {readFirstName(welcome.member.name)}.</h1>
      <p className="type-lead mt-3 text-foreground-soft">{readSharingSentence(welcome)}</p>
      <section
        aria-labelledby="deal-title"
        className="mt-7 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7"
      >
        <h2 id="deal-title" className="type-h2">
          One thing first: the deal
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-field bg-muted px-5 py-card-phone">
            <h3 className="flex items-center gap-2 type-label">
              <UsersRound aria-hidden="true" className="size-5" />
              You share
            </h3>
            <p className="mt-1.5 type-note text-foreground-soft">
              Joining shares your Village network with{" "}
              <strong className="font-bold text-foreground">every current and future member</strong> of this
              community. They can find your contacts and ask you for introductions.
            </p>
          </div>
          <div className="rounded-field bg-accent px-5 py-card-phone">
            <h3 className="flex items-center gap-2 type-label">
              <Waypoints aria-hidden="true" className="size-5" />
              You get
            </h3>
            <p className="mt-1.5 type-note text-foreground-soft">
              You gain access to the networks of the other members in return. Search them and see who can introduce
              you, and why.
            </p>
          </div>
        </div>
        <ul className="mt-[18px] grid gap-2.5">
          {DEAL_NOTES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 type-note text-foreground-soft">
              <Icon aria-hidden="true" className="mt-0.5 size-icon-small shrink-0 text-brand-emphasis" />
              <span className="min-w-0">{text}</span>
            </li>
          ))}
        </ul>
        <form action={consentMutation.mutate} className="mt-5 grid gap-5">
          <FormError message={consentMutation.error?.message ?? null} />
          <CheckboxCard id={CONSENT_FIELD_ID} name={CONSENT_FIELD_ID}>
            I understand and want to share my network with this community.
          </CheckboxCard>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="lg" disabled={consentMutation.isPending}>
              {consentMutation.isPending ? "Saving…" : "Share my network"}
              <ArrowRight aria-hidden="true" />
            </Button>
            <NotNowAction welcome={welcome} />
          </div>
          <p className="type-small text-muted-foreground">
            Not now shares nothing. Network search waits until you share, and you can come back here from Network any
            time.
          </p>
        </form>
      </section>
    </JoinLayout>
  );
}
