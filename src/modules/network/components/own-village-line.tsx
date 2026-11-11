import { CircleCheck, CircleDashed } from "lucide-react";

import { formatShortDate } from "@/platform/text/format-date";

type OwnVillageLineProps = { isConnected: boolean; checkedAt: Date };

// The member's own Village status, from the admin's last Village check.
export function OwnVillageLine({ isConnected, checkedAt }: OwnVillageLineProps) {
  const Icon = isConnected ? CircleCheck : CircleDashed;
  return (
    <p className="fh-strip" data-own-village-state={isConnected ? "connected" : "not-connected"}>
      <Icon aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
      <span>
        Village: {isConnected ? "Connected · your network is shared" : "Not connected yet"} · Checked {formatShortDate(checkedAt)}
      </span>
    </p>
  );
}
