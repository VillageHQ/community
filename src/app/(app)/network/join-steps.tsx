import { cn } from "cn";
import { Check } from "lucide-react";

export const JOIN_STEPS = { linkedin: "linkedin", share: "share", sync: "sync" } as const;

type JoinStep = (typeof JOIN_STEPS)[keyof typeof JOIN_STEPS];

const JOIN_STEP_ORDER: { id: JoinStep; label: string }[] = [
  { id: JOIN_STEPS.linkedin, label: "Your LinkedIn" },
  { id: JOIN_STEPS.share, label: "The deal" },
  { id: JOIN_STEPS.sync, label: "Sync" },
];

export function JoinSteps({ current }: { current: JoinStep }) {
  const currentPosition = JOIN_STEP_ORDER.findIndex(({ id }) => id === current);
  return (
    <ol aria-label="Joining the network" className="mb-7 flex flex-wrap items-center gap-2">
      {JOIN_STEP_ORDER.map(({ id, label }, position) => {
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
