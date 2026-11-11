"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useFlash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { resendInviteRequest } from "@/modules/members/queries-invites";

// Resend on an invited member's row: a new link goes out and the old one stops working.
export function ResendInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const showFlash = useFlash();
  const resend = useMutation({
    mutationFn: resendInviteRequest,
    onSuccess: () => {
      showFlash("Invite sent again. The old link no longer works.");
      router.refresh();
    },
    onError: (error) => showFlash(error.message, { kind: "needs" }),
  });
  return (
    <Button type="button" variant="quiet" size="sm" disabled={resend.isPending} onClick={() => resend.mutate(inviteId)}>
      {resend.isPending ? "Sending…" : "Resend"}
    </Button>
  );
}
