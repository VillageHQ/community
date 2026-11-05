import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getDatabase } from "@/database/client";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";
import { inboxQuery } from "@/lib/messages/message-queries";
import { readInbox } from "@/lib/messages/message-reads";
import { requireMember } from "@/lib/session";

import { MessagePanes } from "./message-panes";

export const metadata: Metadata = { title: PAGE_TITLES.messages };

export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const member = await requireMember();
  const queryClient = new QueryClient();
  const firstPage = await readInbox(getDatabase(), member.id, { search: "", cursor: null });
  queryClient.setQueryData(inboxQuery().queryKey, { pages: [firstPage], pageParams: [null] });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MessagePanes>{children}</MessagePanes>
    </HydrationBoundary>
  );
}
