import { cn } from "cn";
import type { ComponentProps } from "react";

// Founderhall's field (crop form-intro-ask.png): min 44 px, 1 px Graphite border, radius 6, Leaf, 15/22; focus = 2 px
// fund outline. The same look serves Input, Textarea and Select.
export const FIELD_CLASSES =
  "block w-full min-w-0 min-h-11 rounded-input border border-input bg-leaf px-3 py-2.5 text-[15px] leading-[22px] text-foreground placeholder:text-[#6e766f] focus:border-fund focus:outline-2 focus:outline-offset-0 focus:outline-fund disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-ribbon";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input data-slot="input" className={cn(FIELD_CLASSES, className)} {...props} />;
}
