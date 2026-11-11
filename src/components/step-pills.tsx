import { cn } from "cn";

type StepPillsProps = { label: string; steps: { id: string; label: string }[]; current: string };

// Founderhall's onboarding steps: a row of step dots over "Step 1 of 2" (4 px bars, the fund colour up to the
// current step). Each step keeps its name for screen readers.
export function StepPills({ label: stepsLabel, steps, current }: StepPillsProps) {
  const currentPosition = Math.max(0, steps.findIndex(({ id }) => id === current));
  return (
    <div data-slot="step-dots">
      <ol aria-label={stepsLabel} className="fh-steps-dots list-none p-0">
        {steps.map(({ id, label }, position) => (
          <li key={id} aria-current={position === currentPosition ? "step" : undefined} className="contents">
            <i className={cn(position <= currentPosition && "fh-on")}>
              <span className="sr-only">
                {label}
                {position < currentPosition ? " (done)" : ""}
              </span>
            </i>
          </li>
        ))}
      </ol>
      <p className="fh-small fh-muted mb-1.5">
        Step {currentPosition + 1} of {steps.length}
      </p>
    </div>
  );
}
