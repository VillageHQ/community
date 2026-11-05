"use client";

import { JoinLayout } from "@/modules/members/components/shared/join-layout";
import { EmailConfirmationNotice } from "@/modules/members/components/shared/email-confirmation-notice";
import { FinishOnboardingButton } from "@/modules/members/components/shared/not-now-action";
import { ONBOARDING_PILLS, OnboardingSteps } from "@/modules/members/components/shared/onboarding-steps";
import type { WelcomeContext } from "@/modules/members/components/shared/welcome-context";

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
