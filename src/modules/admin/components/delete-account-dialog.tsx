"use client";

import { Trash2 } from "lucide-react";
import { useState, type ReactNode, type RefObject } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readFirstName } from "@/platform/design/avatar-identity";
import { API_ROUTES } from "@/platform/http/routes";
import { postRequest } from "@/platform/http/post-request";
import { DELETE_CONFIRMATION_WORD, deleteAccountResponseSchema } from "@/modules/members/contract-privacy";

import { ConfirmDialog } from "./confirm-dialog";

type DeleteAccountDialogProps = {
  member: { id: string; name: string };
  trigger: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackFocusId?: string;
  onDone: (message: string, isWarning: boolean) => void;
};

// The same real delete a member can run on Your data, run by an admin. It needs the word typed, like the member's own.
export function DeleteAccountDialog({ member, trigger, returnFocusRef, fallbackFocusId, onDone }: DeleteAccountDialogProps) {
  const [typed, setTyped] = useState("");
  const firstName = readFirstName(member.name);
  return (
    <ConfirmDialog
      trigger={trigger}
      title={`Delete ${member.name}'s account and data?`}
      confirmLabel="Delete for good"
      pendingLabel="Deleting…"
      isDestructive
      isConfirmDisabled={typed.trim().toLowerCase() !== DELETE_CONFIRMATION_WORD}
      returnFocusRef={returnFocusRef}
      fallbackFocusId={fallbackFocusId}
      action={() => postRequest(API_ROUTES.memberDelete, { memberId: member.id, confirmation: typed }, deleteAccountResponseSchema)}
      onDone={({ message, isVillageIncomplete }) => onDone(message, isVillageIncomplete)}
    >
      <p>
        Use this when {firstName} asks to be deleted. Their card, photo, posts, asks, answers, offers and the words of their messages go for good, and they can&apos;t sign in.
        Village is asked to remove them too. Intros stay only as anonymous counts, so the partner report doesn&apos;t change. There is no undo.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="admin-delete-confirmation">Type &quot;{DELETE_CONFIRMATION_WORD}&quot; to confirm</Label>
        <Input id="admin-delete-confirmation" autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} />
      </div>
    </ConfirmDialog>
  );
}

export const DELETE_ACCOUNT_ICON = <Trash2 aria-hidden="true" />;
