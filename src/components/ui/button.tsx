import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

// Founderhall's buttons (design-system.md §3.2, crops buttons-*.png): 40 px, radius 6, sans 600 15/20, press 1 px.
// A label too long for a phone wraps instead of running off the screen; one line keeps the 40 px exactly.
export const buttonVariants = cva(
  "fh-btn h-auto text-center whitespace-normal disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-icon-small",
  {
    variants: {
      variant: {
        // The one main action of a card: the fund colour.
        primary: "fh-btn-primary",
        // The page's top action ("Ask for an intro", "Partner report").
        ink: "fh-btn-ink",
        secondary: "fh-btn-secondary",
        // Older names for the secondary button, kept so every screen takes the new look.
        outline: "fh-btn-secondary",
        soft: "fh-btn-secondary",
        quiet: "fh-btn-quiet",
        destructive: "border-destructive bg-destructive text-destructive-foreground hover:bg-ribbon hover:text-leaf",
        link: "fh-linkbtn h-auto min-h-0 p-0 font-semibold text-fund underline hover:text-fund-deep hover:no-underline",
      },
      size: {
        default: "min-h-10 py-[9px]",
        sm: "fh-btn-sm min-h-8 py-[5px]",
        // Founderhall has one size of large button: the default.
        lg: "min-h-10 py-[9px]",
        hero: "min-h-10 py-[9px]",
        icon: "size-10 rounded-[8px] p-0 [&_svg:not([class*='size-'])]:size-icon",
        "icon-lg": "size-10 rounded-[8px] p-0 [&_svg:not([class*='size-'])]:size-icon",
      },
      width: {
        auto: "",
        // Full width: public pages and phone forms.
        block: "fh-btn-block",
      },
    },
    compoundVariants: [{ variant: "link", className: "min-h-0 py-0" }],
    defaultVariants: { variant: "primary", size: "default", width: "auto" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, width, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      data-slot="button"
      data-variant={variant ?? "primary"}
      data-size={size ?? "default"}
      className={cn(buttonVariants({ variant, size, width }), className)}
      {...props}
    />
  );
}

// A row of buttons: wraps, 8 px apart.
export function ButtonRow({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="button-row" className={cn("fh-btn-row", className)} {...props} />;
}
