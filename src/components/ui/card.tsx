import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

// Founderhall's sheet (crop sheet-sidebar-card.png): flat Leaf, 1 px rule, radius 8, padding 18/16 → 22/24, no shadow.
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("rounded-card border border-rule bg-card px-4 py-[18px] text-card-foreground lg:px-6 lg:py-[22px]", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("grid gap-1.5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 data-slot="card-title" className={cn("type-h3 text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("type-small text-foreground-soft", className)} {...props} />;
}

// The sheet's head row: the title left, one 14 px link right ("Partner report", "All 12").
export function SheetHead({ title, link, headingLevel: Heading = "h2" }: { title: ReactNode; link?: ReactNode; headingLevel?: "h2" | "h3" }) {
  return (
    <div className="fh-sheet-head mb-3 flex items-baseline justify-between gap-3 [&_a]:text-[14px] [&_a]:font-semibold [&_a]:whitespace-nowrap [&_a]:text-fund">
      <Heading className="type-h3">{title}</Heading>
      {link}
    </div>
  );
}
