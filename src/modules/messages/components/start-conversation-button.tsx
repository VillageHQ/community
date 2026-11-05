"use client";

import { useMutation } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import type { MemberConversationProps } from "@/modules/members/slots";
import { startConversationRequest } from "@/modules/messages/queries";
import { ROUTES } from "@/platform/http/routes";

import { requestThreadFocus, THREAD_FOCUS_TARGETS } from "./thread-focus";

export function StartConversationButton({
  memberId,
  accessibleName,
  label,
  showsIcon = true,
  ...buttonProps
}: MemberConversationProps) {
  const router = useRouter();
  const [isNavigating, startNavigating] = useTransition();
  const start = useMutation({
    mutationFn: () => startConversationRequest(memberId),
    onSuccess: ({ conversationId }) => {
      requestThreadFocus(THREAD_FOCUS_TARGETS.composer);
      startNavigating(() => router.push(`${ROUTES.messages}/${conversationId}`));
    },
  });
  const isBusy = start.isPending || isNavigating;

  return (
    <>
      <Button
        type="button"
        aria-label={accessibleName}
        aria-busy={isBusy}
        disabled={isBusy}
        onClick={() => start.mutate()}
        {...buttonProps}
      >
        {showsIcon ? <MessageCircle aria-hidden="true" /> : null}
        {label}
      </Button>
      {start.error ? (
        <div className="basis-full">
          <FormError message={start.error.message} />
        </div>
      ) : null}
    </>
  );
}
