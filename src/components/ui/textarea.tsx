import { cn } from "cn";
import type { ComponentProps } from "react";

import { FIELD_CLASSES } from "./input";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(FIELD_CLASSES, "min-h-[140px] resize-y", className)} {...props} />;
}
