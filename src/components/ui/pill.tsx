import { cn } from "cn";
import type { ComponentProps } from "react";

// Founderhall's status pill (crop pill.png): 24 px, radius 5, 500 12.5, a 7 px dot before the words.
// made = Spine on Spine tint; open = Ink on Vellum with a hollow dot; declined = Graphite with a dash;
// needs = Ribbon on Ribbon tint; plain = no dot.
export const PILL_TONES = { made: "made", open: "open", declined: "declined", needs: "needs", plain: "plain", neutral: "neutral" } as const;

export type PillTone = keyof typeof PILL_TONES;

export function Pill({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: PillTone }) {
  return <span data-slot="pill" className={cn("fh-pill", tone !== "neutral" && `fh-${tone}`, className)} {...props} />;
}
