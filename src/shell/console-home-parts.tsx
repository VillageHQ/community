import { cn } from "cn";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";

type Variant = "primary" | "secondary" | "quiet" | "ink";

// A button that goes somewhere (Founderhall's `a.btn`).
export function ButtonLink({ href, variant = "secondary", isSmall = false, children, className }: { href: string; variant?: Variant; isSmall?: boolean; children: ReactNode; className?: string }) {
  return (
    <Link href={href} data-slot="button" className={cn(buttonVariants({ variant, size: isSmall ? "sm" : "default" }), className)}>
      {children}
    </Link>
  );
}

// Founderhall's plain link: the fund colour, underlined, deeper on hover.
export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn("text-fund underline decoration-1 underline-offset-[3px] hover:text-fund-deep", className)} {...props} />;
}
