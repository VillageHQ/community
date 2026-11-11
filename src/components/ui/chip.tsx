import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

// Founderhall's chip (crops chips-tabs-asks.png, chips-filter-members.png): 34 px, radius 6, Vellum, 500 14;
// selected = Ink with Paper text. Used as page tabs and filters; a link chip marks the current page the same way.
const CHIP_CLASSES =
  "fh-chip no-underline aria-[current=page]:bg-ink aria-[current=page]:text-paper";

export function Chip({ className, isPressed, ...props }: ComponentProps<"button"> & { isPressed: boolean }) {
  return <button type="button" aria-pressed={isPressed} className={cn(CHIP_CLASSES, className)} {...props} />;
}

// The count inside a chip, at 72 % opacity ("Open 12").
export function ChipCount({ children }: { children: ReactNode }) {
  return <span className="fh-n">{children}</span>;
}

// A row of chips: wraps on desktop, scrolls sideways on a phone.
export function ChipRow({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="chip-row" className={cn("fh-chips", className)} {...props} />;
}

// Founderhall's example chips (crop example-chips.png): dashed, transparent; they fill a field when pressed.
export function ExampleChips({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="example-chips" className={cn("fh-examples", className)} {...props} />;
}

export { CHIP_CLASSES };
