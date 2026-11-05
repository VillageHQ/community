"use client";

import { ShieldAlert, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode, type RefObject } from "react";

import { CONTENT_CHOICES, type ContentChoice } from "@/modules/admin/contract";
import { departureResponseSchema } from "@/modules/network/contract";
import { readFirstName } from "@/platform/design/avatar-identity";
import { API_ROUTES } from "@/platform/http/routes";
import { postRequest } from "@/platform/http/post-request";

import { ConfirmDialog } from "./confirm-dialog";

const CONTENT_FIELD_NAME = "removal-content-choice";

const CONTENT_OPTIONS: { value: ContentChoice; label: string; hint: string }[] = [
  {
    value: CONTENT_CHOICES.keep,
    label: "Keep their posts and replies",
    hint: "Recommended. They stay in the feed under their name, read-only. You can change your mind by unbanning.",
  },
  {
    value: CONTENT_CHOICES.delete,
    label: "Delete their posts and replies",
    hint: "Gone for good, including replies others wrote under their posts. Copies stay in the audit log. Unbanning won't bring them back.",
  },
];

function VillageConsequence({ name, isInVillageGroup }: { name: string; isInVillageGroup: boolean }) {
  const firstName = readFirstName(name);
  if (!isInVillageGroup) {
    return <p className="type-small rounded-field bg-muted p-4">As far as this site knows, {firstName} isn&apos;t in the Village group, so there&apos;s no shared network to think about.</p>;
  }
  return (
    <div className="type-small grid gap-2 rounded-field bg-gold-soft p-4 text-gold-text">
      <p className="flex items-center gap-2 font-bold">
        <ShieldAlert aria-hidden="true" className="size-icon-small shrink-0" />
        We&apos;ll also take them out of the Village group
      </p>
      <p>
        We ask Village to remove {firstName} from the group on their behalf. Their network stops being shared from then on, but anyone who already saw results through them can&apos;t
        unsee those. If Village doesn&apos;t answer, or refuses because they created the group, they&apos;re still removed here, their network stays shared, and we&apos;ll tell you.
      </p>
    </div>
  );
}

type RemoveMemberDialogProps = {
  member: { id: string; name: string; isAdmin: boolean; isInVillageGroup: boolean };
  trigger: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackFocusId?: string;
  onDone: (message: string, isWarning: boolean) => void;
};

export function RemoveMemberDialog({ member, trigger, returnFocusRef, fallbackFocusId, onDone }: RemoveMemberDialogProps) {
  const [contentChoice, setContentChoice] = useState<ContentChoice>(CONTENT_CHOICES.keep);
  const keepRadioRef = useRef<HTMLInputElement>(null);
  const { id, name, isAdmin, isInVillageGroup } = member;

  return (
    <ConfirmDialog
      trigger={trigger}
      title={`Remove ${name}?`}
      confirmLabel={`Remove ${readFirstName(name)}`}
      pendingLabel="Removing…"
      isDestructive
      initialFocusRef={keepRadioRef}
      returnFocusRef={returnFocusRef}
      fallbackFocusId={fallbackFocusId}
      action={() => postRequest(API_ROUTES.memberRemove, { memberId: id, contentChoice }, departureResponseSchema)}
      onDone={({ message, isGroupLeaveIncomplete }) => onDone(message, isGroupLeaveIncomplete)}
    >
      <p>
        They&apos;re signed out right now and can&apos;t sign back in. They disappear from the member directory. Messages they sent stay with the people they wrote to.
        {isAdmin ? " They also stop being an admin, and stay a regular member if you unban them." : ""}
      </p>
      <fieldset className="grid gap-2">
        <legend className="type-label mb-2 text-foreground">What happens to their posts and replies?</legend>
        {CONTENT_OPTIONS.map(({ value, label, hint }) => (
          <label
            key={value}
            className="flex cursor-pointer items-start gap-3 rounded-field p-4 shadow-[inset_0_0_0_1.5px_var(--input)] has-checked:bg-accent has-checked:shadow-[inset_0_0_0_2.5px_var(--brand-emphasis)]"
          >
            <input
              ref={value === CONTENT_CHOICES.keep ? keepRadioRef : undefined}
              type="radio"
              name={CONTENT_FIELD_NAME}
              value={value}
              checked={contentChoice === value}
              onChange={() => setContentChoice(value)}
              className="mt-1 size-5 shrink-0 accent-[var(--brand-emphasis)]"
            />
            <span className="grid gap-0.5">
              <span className="flex items-center gap-1.5 font-bold text-foreground">
                {value === CONTENT_CHOICES.delete ? <Trash2 aria-hidden="true" className="size-icon-small" /> : null}
                {label}
              </span>
              <span className="type-small">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <VillageConsequence name={name} isInVillageGroup={isInVillageGroup} />
    </ConfirmDialog>
  );
}
