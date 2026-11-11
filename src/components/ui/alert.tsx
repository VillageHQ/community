import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ComponentProps } from "react";

// Founderhall's note (design-system.md §3.5): padding 12/14, radius 6, 14/20; Vellum, or Spine tint when it went
// well, or Ribbon tint when something needs the reader (its bold words in Ribbon).
const alertVariants = cva("fh-note text-left text-ink [&_b]:font-semibold [&_strong]:font-semibold", {
  variants: {
    variant: {
      info: "",
      success: "fh-ok",
      destructive: "fh-needs [&_strong]:text-ribbon",
    },
  },
  defaultVariants: { variant: "info" },
});

const ALERT_ICONS = { info: Info, success: CircleCheck, destructive: CircleAlert };

type AlertProps = ComponentProps<"div"> & VariantProps<typeof alertVariants>;

export function Alert({ className, variant, children, ...props }: AlertProps) {
  const Icon = ALERT_ICONS[variant ?? "info"];
  return (
    <div
      data-slot="alert"
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon aria-hidden="true" strokeWidth={1.5} className="mt-px size-icon-small shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
