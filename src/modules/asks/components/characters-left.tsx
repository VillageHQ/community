import { cn } from "cn";

const SHOWN_WITHIN_FRACTION = 0.2;

export function CharactersLeft({ length, maximumLength }: { length: number; maximumLength: number }) {
  const remaining = maximumLength - length;
  if (remaining > maximumLength * SHOWN_WITHIN_FRACTION) return null;
  return (
    <p role="status" className={cn("type-micro text-muted-foreground", remaining < 0 && "font-bold text-destructive-text")}>
      {remaining < 0 ? `${Math.abs(remaining)} over the limit` : `${remaining} left`}
    </p>
  );
}
