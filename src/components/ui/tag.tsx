import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

// Founderhall's tag (design-system.md §3.3): 24 px, radius 5, Vellum, 13 px. Tones carry the pills' tints.
const tagVariants = cva("fh-tag gap-1.5 [&_svg]:size-[14px] [&_svg]:shrink-0", {
  variants: {
    tone: {
      neutral: "",
      accent: "bg-fund-tint text-fund-deep",
      gold: "bg-ribbon-tint text-ribbon",
      sage: "bg-spine-tint text-spine",
      destructive: "bg-ribbon-tint text-ribbon",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Tag({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof tagVariants>) {
  return <span data-slot="tag" className={cn(tagVariants({ tone }), className)} {...props} />;
}

// A row of tags, 6 px apart.
export function Tags({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="tags" className={cn("fh-tags", className)} {...props} />;
}

// The source badge on a profile line, in Founderhall's words: "you" (fund tint) or "from public profiles" (Vellum).
export function SourceBadge({ source }: { source: "you" | "village" }) {
  return <span className={cn("fh-src", source === "you" ? "fh-you" : "fh-village")}>{source === "you" ? "you" : "from public profiles"}</span>;
}

// Warmth of a path ("Close", "Met"): fund tint, or Vellum when they only met.
export function Warmth({ isMet = false, children }: { isMet?: boolean; children: string }) {
  return <span className={cn("fh-warm", isMet && "fh-met")}>{children}</span>;
}
