"use client";

import { JoinLayout } from "../network/join-layout";
import { EmailConfirmationNotice } from "../network/email-confirmation-notice";
import { FinishOnboardingButton } from "../network/not-now-action";
import { ONBOARDING_PILLS, OnboardingSteps } from "../network/onboarding-steps";
import type { WelcomeContext } from "../network/welcome-context";

const CONTINUE_LABEL = "Continue to Home";

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
