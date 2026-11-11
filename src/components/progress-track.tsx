import { cn } from "cn";

type ProgressTrackProps = { doneCount: number; totalCount: number; label: string };

// Founderhall's step dots (onboarding, the guided ask): 4 px bars, the fund colour when done.
export function ProgressTrack({ doneCount, totalCount, label }: ProgressTrackProps) {
  const positions = Array.from({ length: totalCount }, (_unused, position) => position);
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={totalCount} aria-valuenow={doneCount} aria-label={label} className="fh-steps-dots">
      {positions.map((position) => (
        <i key={position} className={cn(position < doneCount && "fh-on")} />
      ))}
    </div>
  );
}
