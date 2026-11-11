import { cn } from "cn";

type StepPillsProps = { label: string; steps: { id: string; label: string }[]; current: string };

// Founderhall's onboarding steps: "Step 1 of 2" over a row of step dots (4 px bars, the fund colour up to the
// current step). Each step keeps its name for screen readers.
export function StepPills({ label: stepsLabel, steps, current }: StepPillsProps) {
  const currentPosition = Math.max(0, steps.findIndex(({ id }) => id === current));
  return (
    <div data-slot="step-dots" className="mb-2">
      <p className="fh-small fh-muted">
        Step {currentPosition + 1} of {steps.length}
      </p>
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
    </div>
  );
}
