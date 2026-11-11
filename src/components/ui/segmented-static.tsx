import { cn } from "cn";

// The segmented control's look with no behaviour of its own: for a server page whose segments are submitted with a
// form, and for the parts page. Interactive versions: segmented.tsx.
export function SegmentedControlStatic({ label, segments, current, className }: { label: string; segments: readonly string[]; current: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("fh-seg", className)}>
      {segments.map((segment) => (
        <button key={segment} type="button" aria-pressed={segment === current}>
          {segment}
        </button>
      ))}
    </div>
  );
}
