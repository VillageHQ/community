import { cn } from "cn";
import { Check } from "lucide-react";

type StepPillsProps = { label: string; steps: { id: string; label: string }[]; current: string };

export function StepPills({ label: stepsLabel, steps, current }: StepPillsProps) {
  const currentPosition = steps.findIndex(({ id }) => id === current);
  return (
    <ol aria-label={stepsLabel} className="mb-7 flex flex-wrap items-center gap-2">
      {steps.map(({ id, label }, position) => {
        const isCurrent = id === current;
        const isDone = position < currentPosition;
        return (
          <li
            key={id}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "type-small inline-flex min-h-8 items-center gap-2 rounded-full bg-muted py-1 pr-3.5 pl-1.5 font-semibold text-foreground-soft",
              isCurrent && "bg-accent font-bold text-accent-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-icon items-center justify-center rounded-full bg-card text-[13px] font-bold",
                isCurrent && "bg-primary text-primary-foreground shadow-[inset_0_0_0_1px_var(--brand-edge)]",
              )}
            >
              {isDone ? <Check className="size-3.5" strokeWidth={3} /> : position + 1}
            </span>
            {label}
            {isDone ? <span className="sr-only"> (done)</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
