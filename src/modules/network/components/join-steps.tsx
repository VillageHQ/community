import { StepPills } from "@/components/step-pills";

export const JOIN_STEPS = { linkedin: "linkedin", share: "share", sync: "sync" } as const;

type JoinStep = (typeof JOIN_STEPS)[keyof typeof JOIN_STEPS];

const JOIN_STEP_ORDER: { id: JoinStep; label: string }[] = [
  { id: JOIN_STEPS.linkedin, label: "Your LinkedIn" },
  { id: JOIN_STEPS.share, label: "The deal" },
  { id: JOIN_STEPS.sync, label: "Sync" },
];

export function JoinSteps({ current }: { current: JoinStep }) {
  return <StepPills label="Joining the network" steps={JOIN_STEP_ORDER} current={current} />;
}
