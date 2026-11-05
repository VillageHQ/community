"use client";

import { createContext, useContext, type ComponentProps, type ReactNode } from "react";

import type { Button } from "@/components/ui/button";

export type MemberConversationProps = Pick<ComponentProps<typeof Button>, "variant" | "size" | "className"> & {
  memberId: string;
  accessibleName: string;
  label: string;
  showsIcon?: boolean;
};

export const MemberConversationSlotContext = createContext<((props: MemberConversationProps) => ReactNode) | null>(null);

export function MemberConversationSlot(props: MemberConversationProps) {
  const renderAction = useContext(MemberConversationSlotContext);
  return renderAction ? renderAction(props) : null;
}
