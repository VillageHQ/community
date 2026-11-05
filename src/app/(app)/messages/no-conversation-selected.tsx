"use client";

import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { MessageCircle, Users } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { inboxQuery } from "@/lib/messages/message-queries";
import { readInboxConversations } from "@/lib/messages/thread-cache";
import { ROUTES } from "@/lib/routes";

import { ADMIN_PRIVACY_NOTE } from "./message-copy";

function SelectionPrompt() {
  const { data: inbox } = useSuspenseInfiniteQuery(inboxQuery());
  if (readInboxConversations(inbox).length > 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Pick a conversation"
        description={`Choose someone on the left to pick up where you left off. ${ADMIN_PRIVACY_NOTE}`}
      />
    );
  }
  return (
    <EmptyState
      icon={Users}
      title="No conversations yet"
      description={`Say hi to someone in the community. ${ADMIN_PRIVACY_NOTE}`}
    >
      <Button asChild size="lg">
        <Link href={ROUTES.members}>Meet the members</Link>
      </Button>
    </EmptyState>
  );
}

export function NoConversationSelected() {
  return (
    <div className="flex h-full items-center justify-center bg-card">
      <QueryBoundary loadingMessage="Gathering your conversations…">
        <SelectionPrompt />
      </QueryBoundary>
    </div>
  );
}
