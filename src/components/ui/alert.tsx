import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ComponentProps } from "react";

const alertVariants = cva("type-small flex items-start gap-3 rounded-field px-4 py-3.5 text-left", {
  variants: {
    variant: {
      info: "bg-muted text-foreground-soft",
      success: "bg-sage-soft text-sage-text",
      destructive: "bg-destructive-soft text-destructive-text",
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
      <Icon aria-hidden="true" className="mt-px size-icon-small shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
