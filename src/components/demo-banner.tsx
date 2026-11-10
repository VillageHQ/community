import { DEMO_LABEL, DEMO_NOTE } from "@/platform/demo/mode";

// The strip at the top of every screen while DEMO_MODE=true, so nobody mistakes the demo for a real community.
export function DemoBanner() {
  return (
    <div
      role="note"
      aria-label="This is a demo"
      data-slot="demo-banner"
      className="flex min-h-7 items-center justify-center gap-2 bg-foreground px-3 py-1 text-center text-[13px] leading-4 text-background"
    >
      <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold tracking-wide text-foreground uppercase">{DEMO_LABEL}</span>
      <span>{DEMO_NOTE}</span>
    </div>
  );
}
