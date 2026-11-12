"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { MemberConversationProps } from "@/modules/members/slots";
import { ROUTES } from "@/platform/http/routes";

import { requestThreadFocus, THREAD_FOCUS_TARGETS } from "./thread-focus";

export function toNewMessageHref(memberId: string) {
  return `${ROUTES.newMessage}?${new URLSearchParams({ to: memberId }).toString()}`;
}

// Founderhall's Message button: a link to `/messages/new?to=<member>`, which opens the conversation or starts one.
export function StartConversationButton({ memberId, accessibleName, label, showsIcon = true, ...buttonProps }: MemberConversationProps) {
  return (
    <Button asChild {...buttonProps}>
      <Link href={toNewMessageHref(memberId)} aria-label={accessibleName} onClick={() => requestThreadFocus(THREAD_FOCUS_TARGETS.composer)}>
        {showsIcon ? <MessageSquare aria-hidden="true" /> : null}
        {label}
      </Link>
    </Button>
  );
}
