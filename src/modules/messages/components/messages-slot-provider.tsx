"use client";

import type { ReactNode } from "react";

import { MemberConversationSlotContext, type MemberConversationProps } from "@/modules/members/slots";

import { StartConversationButton } from "./start-conversation-button";

function renderStartConversation(props: MemberConversationProps) {
  return <StartConversationButton {...props} />;
}

export function MessagesSlotProvider({ children }: { children: ReactNode }) {
  return <MemberConversationSlotContext.Provider value={renderStartConversation}>{children}</MemberConversationSlotContext.Provider>;
}
