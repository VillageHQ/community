import { DEMO_LABEL, DEMO_NOTE } from "@/platform/demo/mode";

// The band at the top of every screen while DEMO_MODE=true, so nobody mistakes the demo for a real community.
// Founderhall's demo bar: a Ribbon band, 600 13/18 white, centred.
export function DemoBanner() {
  return (
    <p role="note" aria-label="This is a demo" data-slot="demo-banner" className="fh-demo-bar">
      {DEMO_LABEL}: {DEMO_NOTE}
    </p>
  );
}
