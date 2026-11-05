"use client";

import { JoinLayout } from "@/app/(app)/network/join-layout";
import { EmailConfirmationNotice } from "@/app/(app)/network/email-confirmation-notice";
import { FinishOnboardingButton } from "@/app/(app)/network/not-now-action";
import { ONBOARDING_PILLS, OnboardingSteps } from "@/app/(app)/network/onboarding-steps";
import type { WelcomeContext } from "@/app/(app)/network/welcome-context";

const CONTINUE_LABEL = "Continue to the feed";

export function ConfirmationStep({ welcome }: { welcome: WelcomeContext }) {
  return (
    <JoinLayout welcome={welcome}>
      <OnboardingSteps current={ONBOARDING_PILLS.network} />
      <div className="rounded-card bg-card shadow-panel sm:rounded-panel">
        <EmailConfirmationNotice welcome={welcome} nextAction={<FinishOnboardingButton label={CONTINUE_LABEL} />} />
      </div>
    </JoinLayout>
  );
}
