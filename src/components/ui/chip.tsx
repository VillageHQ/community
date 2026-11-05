import { cn } from "cn";
import type { ComponentProps } from "react";

const CHIP_CLASSES =
  "type-note inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-[18px] font-semibold whitespace-nowrap text-foreground-soft shadow-[inset_0_0_0_1.5px_var(--border)] hover:text-foreground hover:shadow-[inset_0_0_0_1.5px_var(--input)] aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:shadow-none aria-[current=page]:bg-foreground aria-[current=page]:text-background aria-[current=page]:shadow-none";

export function Chip({ className, isPressed, ...props }: ComponentProps<"button"> & { isPressed: boolean }) {
  return <button type="button" aria-pressed={isPressed} className={cn(CHIP_CLASSES, className)} {...props} />;
}

export { CHIP_CLASSES };
