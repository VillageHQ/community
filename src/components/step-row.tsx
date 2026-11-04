import { cn } from "cn";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export const STEP_STATES = { done: "done", current: "current", todo: "todo" } as const;

export type StepState = (typeof STEP_STATES)[keyof typeof STEP_STATES];

const ROW_CLASSES: Record<StepState, string> = {
  done: "bg-transparent shadow-[inset_0_0_0_1.5px_var(--border)]",
  current: "bg-card shadow-[inset_0_0_0_2.5px_var(--brand-emphasis),var(--elevation-panel)]",
  todo: "bg-card shadow-panel",
};

const MARK_CLASSES: Record<StepState, string> = {
  done: "bg-primary text-primary-foreground shadow-[inset_0_0_0_1.5px_var(--brand-edge)]",
  current: "bg-accent text-accent-foreground",
  todo: "bg-muted text-foreground-soft",
};

const STATE_LABELS: Record<StepState, string> = { done: " (done)", current: " (next up)", todo: "" };

type StepRowProps = {
  state: StepState;
  isDone?: boolean;
  number: number;
  title: string;
  description: string;
  action?: ReactNode;
  children?: ReactNode;
};

export function StepRow({ state, isDone = state === STEP_STATES.done, number, title, description, action, children }: StepRowProps) {
  return (
    <li
      data-slot="step-row"
      data-state={state}
      className={cn("rounded-card-phone p-4 sm:rounded-card sm:px-5 sm:py-3.5", ROW_CLASSES[state], children && "sm:p-6")}
    >
      <div className="flex min-h-13 flex-wrap items-center gap-x-4 gap-y-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full font-bold",
            MARK_CLASSES[isDone ? STEP_STATES.done : state],
          )}
        >
          {isDone ? <Check className="size-icon" /> : number}
        </span>
        <div className="min-w-0 flex-[1_1_180px]">
          <h3 className="text-[17px] leading-6 font-bold tracking-[-0.004em]">
            {title}
            <span className="sr-only">{isDone ? STATE_LABELS.done : STATE_LABELS[state]}</span>
          </h3>
          <p className="type-small text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-4 grid gap-4 sm:pl-14">{children}</div> : null}
    </li>
  );
}
