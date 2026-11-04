import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full border-0 text-center font-bold tracking-[-0.003em] transition-[transform,box-shadow,background-color,color] duration-150 ease-out select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-cta hover:-translate-y-px hover:shadow-cta-hover active:translate-y-px",
        soft: "bg-secondary text-secondary-foreground hover:shadow-[inset_0_0_0_1.5px_var(--brand-emphasis)]",
        outline: "bg-card text-foreground shadow-[inset_0_0_0_1.5px_var(--input)] hover:bg-muted",
        quiet: "bg-transparent text-foreground-soft hover:bg-muted hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:-translate-y-px hover:shadow-panel active:translate-y-px",
        link: "min-h-0 bg-transparent p-0 font-bold text-brand-emphasis underline hover:no-underline",
      },
      size: {
        sm: "min-h-11 gap-2 px-card-phone py-2 text-[15px] leading-5 [&_svg:not([class*='size-'])]:size-icon-small",
        default: "min-h-12 gap-2.5 px-6 py-2.5 text-base leading-5 [&_svg:not([class*='size-'])]:size-5",
        lg: "min-h-14 gap-2.5 px-8 py-3 text-[17px] leading-[22px] [&_svg:not([class*='size-'])]:size-5",
        hero: "min-h-16 gap-3 px-10 py-3 text-lg leading-6 [&_svg:not([class*='size-'])]:size-icon",
        icon: "size-11 p-0 [&_svg:not([class*='size-'])]:size-icon",
        "icon-lg": "size-12 p-0 [&_svg:not([class*='size-'])]:size-icon",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      data-slot="button"
      data-variant={variant ?? "primary"}
      data-size={size ?? "default"}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
