"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

const SWITCH_SIZES = {
  default: { root: "h-8 w-12", thumb: "size-6 translate-x-1 data-[state=checked]:translate-x-5" },
  large: { root: "h-11 w-[72px]", thumb: "size-9 translate-x-1 data-[state=checked]:translate-x-8" },
};

type SwitchProps = ComponentProps<typeof SwitchPrimitive.Root> & { size?: keyof typeof SWITCH_SIZES };

export function Switch({ size = "default", ...props }: SwitchProps) {
  const { root, thumb } = SWITCH_SIZES[size];
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={`relative block shrink-0 rounded-full bg-muted shadow-[inset_0_0_0_1.5px_var(--input)] disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:shadow-[inset_0_0_0_1.5px_var(--brand-edge)] ${root}`}
      {...props}
    >
      <SwitchPrimitive.Thumb className={`block rounded-full bg-foreground transition-transform duration-150 data-[state=checked]:bg-primary-foreground ${thumb}`} />
    </SwitchPrimitive.Root>
  );
}
