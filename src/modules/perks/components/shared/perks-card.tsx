import { ChevronRight, Gift } from "lucide-react";

import { PERKS_PAGE } from "../../contract";

// On Today while Perks is on and a marketplace is saved: Founderhall's `.perks-card`, one sheet that links to Perks.
// A full page load (a plain link), so /perks's own Content-Security-Policy header applies.
export function PerksCard({ communityName }: { communityName: string }) {
  return (
    <a href={PERKS_PAGE} className="fh-sheet fh-perks-card mt-3.5">
      <Gift aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
      <span>
        <b>Perks</b>
        <span className="fh-small fh-muted">{`Deals for ${communityName} founders`}</span>
      </span>
      <ChevronRight aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
    </a>
  );
}
