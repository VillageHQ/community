import Link from "next/link";

import { ProgressTrack } from "@/components/progress-track";
import type { NextStep } from "@/shell/next-steps";

// Community's next step on Today (connect your network, confirm your email, finish your card), drawn as one of
// Founderhall's Today items: a small line, the step, one line, and one secondary button.
export function NextStepCard({ nextStep }: { nextStep: NextStep }) {
  const { icon: Icon, kicker, title, description, action, progress } = nextStep;
  return (
    <article className="fh-titem" style={{ marginTop: 12 }}>
      <p className="fh-small fh-muted flex items-center gap-1.5">
        <Icon aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
        {kicker}
      </p>
      <h2 className="fh-h3" style={{ marginTop: 6 }}>
        {title}
      </h2>
      <p className="fh-small" style={{ marginTop: 4 }}>
        {description}
      </p>
      {progress ? (
        <div style={{ marginTop: 12 }}>
          <ProgressTrack {...progress} />
        </div>
      ) : null}
      {action ? (
        <div className="fh-btn-row">
          <Link className="fh-btn fh-btn-secondary fh-btn-sm" href={action.href}>
            {action.label}
          </Link>
        </div>
      ) : null}
    </article>
  );
}
