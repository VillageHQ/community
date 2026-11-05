import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { inboxQuery } from "@/modules/messages/queries";
import { readInbox } from "@/modules/messages/reads";
import { requireMember } from "@/platform/auth/session";

import { MessagePanes } from "@/modules/messages/components/message-panes";
import { messagesManifest } from "@/modules/messages/manifest";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: PAGE_TITLES.messages };

export default modulePage(messagesManifest, async function MessagesLayout({ children }: { children: ReactNode }) {
  const member = await requireMember();
  const queryClient = new QueryClient();
  const firstPage = await readInbox(getDatabase(), member.id, { search: "", cursor: null });
  queryClient.setQueryData(inboxQuery().queryKey, { pages: [firstPage], pageParams: [null] });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MessagePanes>{children}</MessagePanes>
    </HydrationBoundary>
  );
});
