import { Gift } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { DEMO_LABEL } from "@/platform/demo/mode";
import { DEMO_PERKS, DEMO_PERKS_NOTE } from "@/platform/demo/perks";

// Demo mode only: made-up deals in place of the BuiltFirst marketplace, which the demo never frames.
export function DemoPerksList() {
  return (
    <section aria-label="Demo perks" className="grid gap-3">
      <p className="type-small flex flex-wrap items-center gap-2 text-foreground-soft">
        <Tag tone="neutral">{DEMO_LABEL}</Tag>
        {DEMO_PERKS_NOTE}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_PERKS.map((perk) => (
          <li key={perk.company}>
            <Card className="grid h-full content-start gap-1.5 sm:p-5">
              <p className="type-small flex items-center gap-2 text-foreground-soft">
                <Gift aria-hidden="true" className="size-4 text-brand-emphasis" />
                {perk.company} · {perk.category}
              </p>
              <p className="type-label">{perk.offer}</p>
              <p className="type-small text-foreground-soft">{perk.detail}</p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
