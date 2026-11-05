"use client";

import { cn } from "cn";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

import { ConversationList } from "./conversation-list";

export function MessagePanes({ children }: { children: ReactNode }) {
  const activeConversationId = useSelectedLayoutSegment();
  return (
    <div data-slot="messages" className="lg:grid lg:h-dvh lg:grid-cols-[348px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <div className={cn("min-w-0 lg:min-h-0", activeConversationId && "max-lg:hidden")}>
        <ConversationList activeConversationId={activeConversationId} />
      </div>
      <div className={cn("min-w-0 lg:min-h-0", !activeConversationId && "max-lg:hidden")}>{children}</div>
    </div>
  );
}
