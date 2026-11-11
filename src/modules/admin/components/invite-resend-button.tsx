"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { FLASH_KINDS, useFlash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { INVITE_EMAIL_STATUSES } from "@/modules/members/contract-invite-state";
import { resendInviteRequest } from "@/modules/members/queries-invites";
import { ROUTES } from "@/platform/http/routes";

import { INVITE_FLASH_PARAM, INVITE_FLASHES } from "./invite-flashes";

// Founderhall's Resend: a fresh link goes out and the old one stops working; the Invites page says so. With mail
// off, nothing can be emailed, so the new link is shown there for the admin to send.
export function InviteResendButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const showFlash = useFlash();
  const resend = useMutation({
    mutationFn: () => resendInviteRequest(inviteId),
    onSuccess: ({ invite, link }) => {
      if (invite.emailStatus === INVITE_EMAIL_STATUSES.notSent || invite.emailStatus === INVITE_EMAIL_STATUSES.failed) {
        showFlash(`${INVITE_FLASHES.resent} Mail is not set up, so send ${invite.email} this new link yourself: ${link}`, { kind: FLASH_KINDS.needs, on: ROUTES.adminInvites });
        router.push(ROUTES.adminInvites);
      } else {
        router.push(`${ROUTES.adminInvites}?${INVITE_FLASH_PARAM}=resent`);
      }
      router.refresh();
    },
    onError: (error) => showFlash(error.message, { kind: FLASH_KINDS.needs }),
  });
  return (
    <Button type="button" variant="quiet" size="sm" disabled={resend.isPending} onClick={() => resend.mutate()}>
      {resend.isPending ? "Sending…" : "Resend"}
    </Button>
  );
}
