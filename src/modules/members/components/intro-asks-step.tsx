"use client";

import { useMutation } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { useRouter } from "next/navigation";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

import { JoinLayout } from "@/modules/members/components/shared/join-layout";
import { ONBOARDING_PILLS, OnboardingSteps } from "@/modules/members/components/shared/onboarding-steps";
import type { WelcomeContext } from "@/modules/members/components/shared/welcome-context";

function saveAnswer(acceptsIntroAsks: boolean) {
  return postRequest(API_ROUTES.onboardingIntroAsks, { acceptsIntroAsks }, acknowledgedResponseSchema);
}

// A required yes or no, with no default: connectors choose on purpose.
export function IntroAsksStep({ welcome }: { welcome: WelcomeContext }) {
  const router = useRouter();
  const answer = useMutation({ mutationFn: saveAnswer, onSuccess: () => router.refresh() });
  return (
    <JoinLayout welcome={welcome}>
      <OnboardingSteps current={ONBOARDING_PILLS.card} showsNetworkStep={welcome.isNetworkOn} />
      <section aria-labelledby="intro-asks-title" className="grid gap-4 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
        <h1 id="intro-asks-title" className="type-h2 flex items-center gap-2">
          <Handshake aria-hidden="true" className="size-6 shrink-0 text-brand-emphasis" />
          Can members ask you for intros?
        </h1>
        <p className="text-foreground-soft">
          Yes means a member can ask you to introduce them to someone you know. You still say yes or no to each ask. No means nobody can ask you. You can change
          this any time on Your data.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={answer.isPending} onClick={() => answer.mutate(true)} className="max-sm:w-full">
            Yes, members can ask me
          </Button>
          <Button type="button" variant="outline" disabled={answer.isPending} onClick={() => answer.mutate(false)} className="max-sm:w-full">
            No, don&apos;t send me intro asks
          </Button>
        </div>
        <FormError message={answer.error?.message ?? null} />
      </section>
    </JoinLayout>
  );
}
