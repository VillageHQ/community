import { StepPills } from "@/components/step-pills";

const WELCOME_STEPS = [
  { id: "about", label: "About you" },
  { id: "privacy", label: "Your privacy" },
];

// The top of both welcome steps: Founderhall's step dots and "Step n of 2".
export function WelcomeStepsHead({ current }: { current: "about" | "privacy" }) {
  return <StepPills label="Welcome steps" steps={WELCOME_STEPS} current={current} />;
}
