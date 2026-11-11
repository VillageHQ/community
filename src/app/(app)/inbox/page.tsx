import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ConversationList } from "@/modules/messages/components/conversation-list";
import { describeInboxLede } from "@/modules/messages/copy";
import { messagesManifest } from "@/modules/messages/manifest";
import { inboxQuery } from "@/modules/messages/queries";
import { readInbox } from "@/modules/messages/reads";
import { requireMember } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: PAGE_TITLES.messages };

// Founderhall's Inbox (inboxPage): the head, then one row per conversation, or the dashed empty state.
export default modulePage(messagesManifest, async function InboxPage() {
  const member = await requireMember();
  const [firstPage, community] = await Promise.all([readInbox(getDatabase(), member.id, { search: "", cursor: null }), readBrandingForPage()]);
  const queryClient = new QueryClient();
  queryClient.setQueryData(inboxQuery().queryKey, { pages: [firstPage], pageParams: [null] });

  return (
    <>
      <PageHeader title="Inbox" description={describeInboxLede(community.name)} />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ConversationList />
      </HydrationBoundary>
    </>
  );
});
