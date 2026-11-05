"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { ONBOARDING_STEPS } from "@/lib/members/profile-api";
import { API_ROUTES, ROUTES } from "@/lib/routes";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

import type { WelcomeContext } from "./welcome-context";

const NOT_NOW_LABEL = "Not now";

function finishOnboarding() {
  return postNetworkRequest(API_ROUTES.onboarding, { step: ONBOARDING_STEPS.network }, acknowledgedResponseSchema);
}

function goHome() {
  window.location.assign(ROUTES.home);
}

export function FinishOnboardingButton({ label = NOT_NOW_LABEL }: { label?: string }) {
  const finishMutation = useMutation({ mutationFn: finishOnboarding, onSuccess: goHome });
  return (
    <>
      <Button
        type="button"
        variant="quiet"
        size="lg"
        disabled={finishMutation.isPending}
        onClick={() => finishMutation.mutate()}
      >
        {label}
      </Button>
      <FormError message={finishMutation.error?.message ?? null} />
    </>
  );
}

export function NotNowAction({ welcome }: { welcome: WelcomeContext }) {
  if (welcome.isOnboarding) return <FinishOnboardingButton />;
  return (
    <Button asChild variant="quiet" size="lg">
      <Link href={welcome.notNowHref}>Not now</Link>
    </Button>
  );
}
