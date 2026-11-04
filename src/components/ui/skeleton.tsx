import { cn } from "cn";
import type { ComponentProps } from "react";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn("animate-shimmer rounded-small", className)} {...props} />;
}
