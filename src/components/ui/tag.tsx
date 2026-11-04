import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

const tagVariants = cva(
  "type-micro inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 py-1 [&_svg]:size-[15px] [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-foreground-soft",
        accent: "bg-secondary text-secondary-foreground",
        gold: "bg-gold-soft text-gold-text",
        sage: "bg-sage-soft text-sage-text",
        destructive: "bg-destructive-soft text-destructive-text",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Tag({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof tagVariants>) {
  return <span data-slot="tag" className={cn(tagVariants({ tone }), className)} {...props} />;
}
