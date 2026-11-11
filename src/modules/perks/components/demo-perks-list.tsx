import { Gift } from "lucide-react";

import { Row, Rows } from "@/components/ui/rows";
import { Tag } from "@/components/ui/tag";
import { DEMO_LABEL } from "@/platform/demo/mode";
import { DEMO_PERKS, DEMO_PERKS_NOTE } from "@/platform/demo/perks";

// Demo mode only: the demo never frames BuiltFirst, so the marketplace's frame holds made-up deals instead.
export function DemoPerksList() {
  return (
    <section aria-label="Demo perks" className="fh-perks-frame p-4 lg:p-5">
      <p className="fh-small fh-muted mb-3 flex flex-wrap items-center gap-2">
        <Tag>{DEMO_LABEL}</Tag>
        {DEMO_PERKS_NOTE}
      </p>
      <Rows>
        {DEMO_PERKS.map((perk) => (
          <Row
            key={perk.company}
            start={<Gift aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />}
            title={perk.offer}
            detail={`${perk.company} · ${perk.category} · ${perk.detail}`}
          />
        ))}
      </Rows>
    </section>
  );
}
