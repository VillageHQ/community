import { cn } from "cn";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

export const STEPPER_STATES = { done: "done", now: "now", todo: "todo", no: "no" } as const;

export type StepperState = keyof typeof STEPPER_STATES;

const STATE_WORDS: Record<StepperState, string> = { done: "done", now: "now", todo: "to come", no: "did not happen" };

// Founderhall's tracker (crop stepper-intro-tracker.png): 24 px nodes joined by a 2 px line. Done = the fund colour
// with a white tick; now = a fund ring, a 4 px tint halo and a dot; todo = hollow; no = Vellum with a Graphite ring.
export function Stepper({ steps, className }: { steps: readonly { key: string; state: StepperState; title: ReactNode; detail?: ReactNode }[]; className?: string }) {
  return (
    <ol data-slot="stepper" className={cn("fh-stepper", className)}>
      {steps.map((step) => (
        <li key={step.key} className={`fh-${step.state}`} aria-current={step.state === STEPPER_STATES.now ? "step" : undefined}>
          <span className="fh-node">
            {step.state === STEPPER_STATES.done ? <Check aria-hidden="true" className="fh-i" /> : null}
            {step.state === STEPPER_STATES.no ? <X aria-hidden="true" className="fh-i" /> : null}
          </span>
          <div className="fh-st">
            <b>
              {step.title}
              <span className="sr-only"> ({STATE_WORDS[step.state]})</span>
            </b>
            {step.detail ? <span>{step.detail}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
