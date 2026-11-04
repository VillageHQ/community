import { cn } from "cn";
import type { ComponentProps } from "react";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "type-body block min-h-14 w-full min-w-0 rounded-input border-0 bg-card px-5 text-foreground shadow-[inset_0_0_0_1.5px_var(--input)] outline-offset-2 transition-shadow duration-150 focus:shadow-[inset_0_0_0_2px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:shadow-[inset_0_0_0_2px_var(--destructive-text)]",
        className,
      )}
      {...props}
    />
  );
}
