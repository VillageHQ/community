import { cn } from "cn";

type ProgressTrackProps = { doneCount: number; totalCount: number; label: string };

function readSegmentClass(position: number, doneCount: number) {
  if (position < doneCount) return "bg-primary shadow-[inset_0_0_0_1px_var(--brand-edge)]";
  if (position === doneCount) return "bg-accent shadow-[inset_0_0_0_1.5px_var(--brand-emphasis)]";
  return "bg-muted";
}

export function ProgressTrack({ doneCount, totalCount, label }: ProgressTrackProps) {
  const positions = Array.from({ length: totalCount }, (_unused, position) => position);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={totalCount}
      aria-valuenow={doneCount}
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1.5"
    >
      {positions.map((position) => (
        <span key={position} className={cn("h-3.5 rounded-full", readSegmentClass(position, doneCount))} />
      ))}
    </div>
  );
}
