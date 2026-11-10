import { cn } from "cn";
import type { ComponentProps } from "react";

// The browser's own select, styled like Input, so it works with every keyboard, screen reader and phone picker.
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "type-body block min-h-12 w-full min-w-0 rounded-input border-0 bg-card px-4 py-2.5 text-foreground shadow-[inset_0_0_0_1.5px_var(--input)] outline-offset-2 transition-shadow duration-150 focus:shadow-[inset_0_0_0_2px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      {...props}
    />
  );
}
