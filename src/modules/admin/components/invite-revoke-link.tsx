"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FLASH_KINDS, useFlash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { revokeInviteRequest } from "@/modules/members/queries-invites";
import { ROUTES } from "@/platform/http/routes";

import { INVITE_FLASH_PARAM } from "./invite-flashes";

// Community-only: cancel an invite so its link stops working. A quiet link; it asks once more, in place.
export function InviteRevokeLink({ inviteId, email }: { inviteId: string; email: string }) {
  const router = useRouter();
  const showFlash = useFlash();
  const [isAsking, setIsAsking] = useState(false);
  const revoke = useMutation({
    mutationFn: () => revokeInviteRequest(inviteId),
    onSuccess: () => {
      router.push(`${ROUTES.adminInvites}?${INVITE_FLASH_PARAM}=revoked`);
      router.refresh();
    },
    onError: (error) => showFlash(error.message, { kind: FLASH_KINDS.needs }),
  });
  if (!isAsking) {
    return (
      <Button type="button" variant="quiet" size="sm" onClick={() => setIsAsking(true)}>
        Revoke
        <span className="sr-only"> the invite to {email}</span>
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Button type="button" variant="secondary" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate()}>
        {revoke.isPending ? "Revoking…" : "Yes, revoke"}
      </Button>
      <Button type="button" variant="quiet" size="sm" onClick={() => setIsAsking(false)}>
        Keep
      </Button>
    </span>
  );
}
