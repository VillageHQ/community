import { cn } from "cn";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export const STEP_STATES = { done: "done", current: "current", todo: "todo" } as const;

export type StepState = (typeof STEP_STATES)[keyof typeof STEP_STATES];

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

// Founderhall's launch list row (crop checklist-status.png, admin-first-home-launch-checklist): a 26 px numbered
// circle (the fund colour with a tick when done), a 600 16/22 title, a Graphite line, ruled under each.
export function StepRow({ state, isDone = state === STEP_STATES.done, number, title, description, action, children }: StepRowProps) {
  return (
    <li data-slot="step-row" data-state={state} className="grid grid-cols-[26px_minmax(0,1fr)] gap-3 border-b border-rule py-4 last:border-b-0">
      <span aria-hidden="true" className={cn("fh-lk grid size-[26px] place-items-center rounded-full border-[1.5px] border-[#9aa39e] bg-spine-tint text-[13px] font-semibold", isDone && "border-fund bg-fund text-leaf")}>
        {isDone ? <Check className="size-[15px]" strokeWidth={2.6} /> : number}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-[1_1_180px]">
            <h3 className="text-[16px] leading-[22px] font-semibold">
              {title}
              <span className="sr-only">{isDone ? STATE_LABELS.done : STATE_LABELS[state]}</span>
            </h3>
            <p className="mt-1 text-[14px] leading-[22px] text-graphite">{description}</p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {children ? <div className="mt-4 grid gap-4">{children}</div> : null}
      </div>
    </li>
  );
}
