"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

import { FLASH_KINDS, useFlash } from "@/components/flash";
import { Note } from "@/components/ui/note";
import type { AdminMember } from "@/modules/admin/contract";
import { GROUP_DEPARTURE_OUTCOMES, type GroupDepartureOutcome } from "@/modules/network/contract";
import { readFirstName } from "@/platform/design/avatar-identity";

import { MemberActions } from "./member-actions";

const MANAGE_TITLE_ID = "manage-member-title";

const REMOVED_GROUP_NOTES: Record<GroupDepartureOutcome, (firstName: string) => string> = {
  [GROUP_DEPARTURE_OUTCOMES.left]: (firstName) => `Village took ${firstName} out of the group. Anyone who already saw results through them can't unsee those.`,
  [GROUP_DEPARTURE_OUTCOMES.creatorRefused]: (firstName) =>
    `${firstName} is still in the Village group. Village refused to take them out, because they created it and other members remain. Their network stays shared until everyone else leaves.`,
  [GROUP_DEPARTURE_OUTCOMES.failed]: (firstName) =>
    `${firstName} is still in the Village group, as far as this site knows. We couldn't take them out, so their network stays shared through Village. Try again, or they can leave inside Village. Here, they count as outside the community.`,
};

// A removed member's Village group: whether they left it.
function RemovedNote({ member }: { member: AdminMember }) {
  const { isRemoved, isErased, isInVillageGroup, hasStaleVillageMembership, villageLeaveOutcome, name } = member;
  if (!isRemoved || isErased) return null;
  const outcome = villageLeaveOutcome ?? (isInVillageGroup || hasStaleVillageMembership ? GROUP_DEPARTURE_OUTCOMES.failed : null);
  if (!outcome) return null;
  return <Note kind={outcome === GROUP_DEPARTURE_OUTCOMES.left ? "ok" : "needs"}>{REMOVED_GROUP_NOTES[outcome](readFirstName(name))}</Note>;
}

// A member's Manage page (Community-only, from the Members table): each tool as a sheet; the result flashes at the top.
export function MemberManage({ member, viewerId }: { member: AdminMember; viewerId: string }) {
  const router = useRouter();
  const showFlash = useFlash();
  const manageButtonRef = useRef<HTMLButtonElement | null>(null);
  return (
    <div className="grid gap-4">
      <RemovedNote member={member} />
      <MemberActions
        member={member}
        viewerId={viewerId}
        manageButtonRef={manageButtonRef}
        fallbackFocusId={MANAGE_TITLE_ID}
        onDone={(message, isWarning) => {
          showFlash(message, { kind: isWarning ? FLASH_KINDS.needs : FLASH_KINDS.ok });
          router.refresh();
        }}
      />
    </div>
  );
}

export { MANAGE_TITLE_ID };
