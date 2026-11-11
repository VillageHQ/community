import { cn } from "cn";
import { CircleCheck, Clock, ShieldCheck, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// Founderhall's note (design-system.md §3.5): Vellum; ok = Spine tint with a check; needs = Ribbon tint with a clock,
// its bold words in Ribbon. For a message after an action, use the flash (components/flash.tsx).
const NOTE_ICONS: Record<string, LucideIcon | null> = { plain: null, ok: CircleCheck, needs: Clock };

type NoteProps = Omit<ComponentProps<"div">, "children"> & { kind?: "plain" | "ok" | "needs"; icon?: LucideIcon | null; children: ReactNode };

export function Note({ kind = "plain", icon, className, children, ...props }: NoteProps) {
  const Icon = icon === undefined ? NOTE_ICONS[kind] : icon;
  return (
    <div data-slot="note" className={cn("fh-note", kind !== "plain" && `fh-${kind}`, className)} {...props}>
      {Icon ? <Icon aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} /> : null}
      <span>{children}</span>
    </div>
  );
}

// The consent line on every intro surface: "Nobody is introduced without saying yes." with a shield.
export function ConsentLine({ children = "Nobody is introduced without saying yes." }: { children?: ReactNode }) {
  return (
    <p data-slot="consent" className="fh-consent">
      <ShieldCheck aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
      <span>{children}</span>
    </p>
  );
}

// A quote box inside a card (an intro's note): Paper, radius 6.
export function QuoteBox({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="quote" className={cn("mt-2.5 rounded-field bg-paper px-3 py-2.5 text-[14px] leading-[21px]", className)} {...props} />;
}

// The "Why you:" box in the fund tint (crop why-you-box.png).
export function WhyYouBox({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="why-you" className={cn("mt-2.5 rounded-field bg-fund-tint px-3 py-2.5 text-[14px] leading-5 text-fund-deep", className)} {...props} />;
}

// A code (reply codes such as "HELP 1"): mono 12.5 on Vellum.
export function Code({ children }: { children: ReactNode }) {
  return <code className="fh-code">{children}</code>;
}
