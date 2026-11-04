"use client";

import { cn } from "cn";
import { Label as LabelPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("type-label text-foreground", className)}
      {...props}
    />
  );
}
