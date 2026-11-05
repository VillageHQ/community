"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import type { IssuedInvite } from "@/modules/members/contract-invites";

import { ConfirmDialog } from "@/app/(app)/admin/confirm-dialog";
import { INVITE_QUERY_KEYS, reclaimInviteRequest } from "@/modules/members/queries-invites";
import { IssuedLink } from "@/modules/members/components/issued-link";
import { ADMIN_MEMBER_QUERY_KEYS } from "./member-queries";

type ReclaimActionProps = {
  inviteId: string;
  email: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackFocusId?: string;
  onReclaimed?: (issued: IssuedInvite) => void;
};

export function ReclaimAction({ inviteId, email, returnFocusRef, fallbackFocusId, onReclaimed }: ReclaimActionProps) {
  const queryClient = useQueryClient();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="quiet" size="sm">
          Wrong person?
          <span className="sr-only"> {email}</span>
        </Button>
      }
      title="Did someone else use this invite?"
      successTitle="We locked it. Here's the new invite"
      confirmLabel="Lock it and make a new invite"
      pendingLabel="Locking…"
      isDestructive
      returnFocusRef={returnFocusRef}
      fallbackFocusId={fallbackFocusId}
      action={() => reclaimInviteRequest(inviteId)}
      onDone={(issued) => {
        onReclaimed?.(issued);
        void Promise.all(
          [INVITE_QUERY_KEYS.list, INVITE_QUERY_KEYS.waiting, ADMIN_MEMBER_QUERY_KEYS.list].map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] })),
        );
      }}
      renderSuccess={(issued) => <IssuedLink issued={issued} />}
    >
      <p className="wrap-anywhere">This locks the account that used this invite and makes a new invite for {email}. Do this if someone else got hold of the link.</p>
      <p>If that account already joined the Village group, we ask Village to take it out too, and tell you how that went.</p>
    </ConfirmDialog>
  );
}
