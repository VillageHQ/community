"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Intro } from "./contract";

// "See who else can help" under an ask nobody said yes to: other Village paths to the same person. The shell fills it
// while Network is on, so intros never imports network. Empty otherwise.
export const IntroOtherPathsSlotContext = createContext<((intro: Intro) => ReactNode) | null>(null);

export function IntroOtherPathsSlot({ intro }: { intro: Intro }) {
  const renderOtherPaths = useContext(IntroOtherPathsSlotContext);
  return renderOtherPaths ? renderOtherPaths(intro) : null;
}
