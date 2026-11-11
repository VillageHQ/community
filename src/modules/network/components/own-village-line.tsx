import { CircleCheck, CircleDashed } from "lucide-react";

import { formatShortDate } from "@/platform/text/format-date";

type OwnVillageLineProps = { isConnected: boolean; checkedAt: Date };

// The member's own Village status, from the admin's last Village check.
export function OwnVillageLine({ isConnected, checkedAt }: OwnVillageLineProps) {
  const Icon = isConnected ? CircleCheck : CircleDashed;
  return (
    <p className="type-small mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-foreground-soft" data-own-village-state={isConnected ? "connected" : "not-connected"}>
      <Icon aria-hidden="true" className={`size-4 shrink-0 ${isConnected ? "text-sage-text" : ""}`} />
      <span className="font-semibold text-foreground">Village: {isConnected ? "Connected · your network is shared" : "Not connected yet"}</span>
      <span>Checked {formatShortDate(checkedAt)}</span>
    </p>
  );
}
