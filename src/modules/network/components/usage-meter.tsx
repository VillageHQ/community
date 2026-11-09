import { cn } from "cn";

type UsageMeterProps = { label: string; value: number; maximum: number; valueText: string; isWarning?: boolean };

// A plain bar for "how much of the allowance is used". The text says the same thing in words.
export function UsageMeter({ label, value, maximum, valueText, isWarning = false }: UsageMeterProps) {
  const percent = maximum > 0 ? Math.min(Math.round((value / maximum) * 100), 100) : 0;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="type-label">{label}</span>
        <span className="type-small tabular-nums text-foreground-soft">{valueText}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={maximum}
        aria-valuenow={Math.min(value, maximum)}
        aria-valuetext={valueText}
        className="h-3.5 overflow-hidden rounded-full bg-muted"
      >
        <span
          className={cn("block h-full rounded-full", isWarning ? "bg-destructive-text" : "bg-primary shadow-[inset_0_0_0_1px_var(--brand-edge)]")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
