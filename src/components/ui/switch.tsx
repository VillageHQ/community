"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

export function Switch(props: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className="relative block h-8 w-12 shrink-0 rounded-full bg-muted shadow-[inset_0_0_0_1.5px_var(--input)] data-[state=checked]:bg-primary data-[state=checked]:shadow-[inset_0_0_0_1.5px_var(--brand-edge)]"
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-6 translate-x-1 rounded-full bg-foreground transition-transform duration-150 data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground" />
    </SwitchPrimitive.Root>
  );
}
