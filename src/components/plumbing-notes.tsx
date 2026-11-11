import { CircleCheck, KeyRound } from "lucide-react";
import type { ReactNode } from "react";

import { Note } from "@/components/ui/note";

// Founderhall's self-host box (selfHostBox, admin pages only): what runs with no key, what needs a Village plan, and
// what the managed plan does in week 1. On Set up › Mail, and on Set up › Village without a key.
export function SelfHostBox({ pricingUrl, id = "self-host" }: { pricingUrl: string; id?: string }) {
  return (
    <section id={id} className="fh-sheet fh-selfhost">
      <h2 className="fh-h3">
        <KeyRound aria-hidden="true" className="fh-i fh-s inline-block align-[-3px]" strokeWidth={1.5} /> Running it yourself
      </h2>
      <p className="fh-small" style={{ marginTop: 8 }}>
        <b>Works without any key:</b> directory, profiles members fill in, asks, intros between members, messages.
      </p>
      <p className="fh-small" style={{ marginTop: 6 }}>
        <b>Needs a Village plan:</b> profile fill-in, warm paths, search beyond members.
      </p>
      <p className="fh-small" style={{ marginTop: 10 }}>
        <CircleCheck aria-hidden="true" className="fh-i fh-xs inline-block align-[-3px]" strokeWidth={1.5} /> <b>Managed plan:</b> Village sets up the mail domain and lookups
        for you in week 1. <a href={pricingUrl}>Full pricing on the Founderhall site</a>
      </p>
    </section>
  );
}

// The managed plan's note where a key or a mail setting is still empty (villageSetsUp): no paste fields, and the
// date Village gave when there is one ("Mon 10 Nov").
export function VillageSetsUp({ what, by }: { what: ReactNode; by: string | null }) {
  return (
    <Note kind="ok" className="fh-village-sets">
      <b>
        Village sets {what} up for you{by ? <> by <b>{by}</b></> : null}.
      </b>{" "}
      Nothing to paste: it shows here once it is done.
    </Note>
  );
}
