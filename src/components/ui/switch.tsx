"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

// Founderhall's switch (crop switch.png): 44×26, off #B7B0A1, on the fund colour, a 20 px Leaf knob.
// A dialog trigger overwrites data-state on its child, so the track follows aria-checked, which only the switch sets.
type SwitchProps = ComponentProps<typeof SwitchPrimitive.Root> & { size?: "default" | "large" };

export function Switch({ size: _size = "default", ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className="relative block h-[26px] w-11 shrink-0 rounded-[13px] bg-[#b7b0a1] transition-colors duration-200 disabled:opacity-45 aria-checked:bg-fund"
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-[3px] rounded-full bg-[#fffdf8] shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-transform duration-200 data-[state=checked]:translate-x-[21px]" />
    </SwitchPrimitive.Root>
  );
}
