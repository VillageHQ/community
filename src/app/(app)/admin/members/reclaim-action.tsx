"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import type { IssuedInvite } from "@/lib/invites/invite-api";

import { INVITE_QUERY_KEYS, reclaimInviteRequest } from "./invite-queries";

type ReclaimActionProps = { inviteId: string; email: string; onReclaimed: (issued: IssuedInvite) => void };

export function ReclaimAction({ inviteId, email, onReclaimed }: ReclaimActionProps) {
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);
  const reclaimMutation = useMutation({
    mutationFn: reclaimInviteRequest,
    onSuccess: (issued) => {
      onReclaimed(issued);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: [INVITE_QUERY_KEYS.list] }),
        queryClient.invalidateQueries({ queryKey: [INVITE_QUERY_KEYS.waiting] }),
      ]);
    },
  });

  if (!isConfirming) {
    return (
      <Button
        type="button"
        variant="quiet"
        size="sm"
        onClick={() => setIsConfirming(true)}
      >
        Wrong person?
        <span className="sr-only"> {email}</span>
      </Button>
    );
  }

  return (
    <div className="grid basis-full gap-2 rounded-field bg-muted p-3.5">
      <p className="type-small text-foreground-soft">
        This locks the account that used this invite and makes a new invite for {email}. Do this if someone else got
        hold of the link. If that account already joined the Village group, it stays in the group. This can&apos;t remove
        it from Village.
      </p>
      <FormError message={reclaimMutation.error?.message ?? null} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={reclaimMutation.isPending}
          onClick={() => reclaimMutation.mutate(inviteId)}
        >
          {reclaimMutation.isPending ? "Locking…" : "Lock it and make a new invite"}
        </Button>
        <Button type="button" variant="quiet" size="sm" onClick={() => setIsConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
