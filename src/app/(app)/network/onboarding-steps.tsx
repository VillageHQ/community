import { StepPills } from "@/components/step-pills";

export const ONBOARDING_PILLS = { card: "card", network: "network" } as const;

type OnboardingPill = (typeof ONBOARDING_PILLS)[keyof typeof ONBOARDING_PILLS];

const ONBOARDING_PILL_ORDER = [
  { id: ONBOARDING_PILLS.card, label: "Your card" },
  { id: ONBOARDING_PILLS.network, label: "Your network" },
];

export function OnboardingSteps({ current }: { current: OnboardingPill }) {
  return <StepPills label="Getting started" steps={ONBOARDING_PILL_ORDER} current={current} />;
}
