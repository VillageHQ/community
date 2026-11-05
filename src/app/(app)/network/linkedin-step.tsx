"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { readFirstName } from "@/lib/design/avatar-identity";
import { API_ROUTES, ROUTES } from "@/lib/routes";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

import { JOIN_STEPS, JoinSteps } from "./join-steps";
import { JoinLayout } from "./join-layout";
import { NotNowAction } from "./not-now-action";
import { OnboardingSteps, ONBOARDING_PILLS } from "./onboarding-steps";
import { readSharingSentence, type WelcomeContext } from "./welcome-context";

const LINKEDIN_FIELD = "linkedinUrl";

function saveLinkedinUrl(formData: FormData) {
  return postNetworkRequest(
    API_ROUTES.networkLinkedin,
    { linkedinUrl: String(formData.get(LINKEDIN_FIELD)) },
    acknowledgedResponseSchema,
  );
}

function reopenPage(path: string) {
  window.location.assign(path);
}

type LinkedinFormProps = {
  onSaved: () => unknown;
  submitLabel: string;
  notNowHref?: string;
  notNowAction?: ReactNode;
};

export function LinkedinForm({ onSaved, submitLabel, notNowHref, notNowAction }: LinkedinFormProps) {
  const saveMutation = useMutation({ mutationFn: saveLinkedinUrl, onSuccess: onSaved });

  return (
    <form action={saveMutation.mutate} className="grid gap-5">
      <FormError message={saveMutation.error?.message ?? null} />
      <FormField
        name={LINKEDIN_FIELD}
        label="LinkedIn profile URL"
        type="url"
        autoComplete="url"
        placeholder="https://www.linkedin.com/in/your-name"
        required
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : submitLabel}
          <ArrowRight aria-hidden="true" />
        </Button>
        {notNowAction}
        {notNowHref ? (
          <Button asChild variant="quiet" size="lg">
            <Link href={notNowHref}>Not now</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function LinkedinWelcome({ welcome }: { welcome: WelcomeContext }) {
  return (
    <JoinLayout welcome={welcome}>
      {welcome.isOnboarding ? <OnboardingSteps current={ONBOARDING_PILLS.network} /> : <JoinSteps current={JOIN_STEPS.linkedin} />}
      <h1 className="type-h1 lg:type-display">Welcome in, {readFirstName(welcome.member.name)}.</h1>
      <p className="type-lead mt-3 text-foreground-soft">{readSharingSentence(welcome)}</p>
      <section
        aria-labelledby="linkedin-title"
        className="mt-7 grid gap-5 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7"
      >
        <div className="grid gap-1.5">
          <h2 id="linkedin-title" className="type-h2">
            Add your LinkedIn profile
          </h2>
          <p className="text-foreground-soft">
            It shows on your profile, and other members see a community badge when you appear in their introduction
            paths.
          </p>
        </div>
        <LinkedinForm
          onSaved={() => reopenPage(welcome.isOnboarding ? ROUTES.welcome : ROUTES.network)}
          submitLabel="Save and continue"
          notNowAction={<NotNowAction welcome={welcome} />}
        />
      </section>
    </JoinLayout>
  );
}
