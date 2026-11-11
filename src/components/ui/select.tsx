import { cn } from "cn";
import type { ComponentProps } from "react";

import { FIELD_CLASSES } from "./input";

// The browser's own select, styled like Input with Founderhall's drawn chevron, so it works with every keyboard,
// screen reader and phone picker.
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select data-slot="select" className={cn(FIELD_CLASSES, "fh-select", className)} {...props} />;
}
