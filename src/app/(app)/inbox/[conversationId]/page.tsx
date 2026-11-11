import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Thread } from "@/modules/messages/components/thread";
import { conversationIdSchema } from "@/modules/messages/contract";
import { messagesManifest } from "@/modules/messages/manifest";
import { threadQuery } from "@/modules/messages/queries";
import { readThreadPage } from "@/modules/messages/reads";
import { requireMember } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";

type ConversationPageProps = { params: Promise<{ conversationId: string }> };

async function readPage(requestedId: string) {
  const member = await requireMember();
  const conversationId = conversationIdSchema.safeParse(requestedId);
  if (!conversationId.success) return null;
  return readThreadPage(getDatabase(), { viewerId: member.id, conversationId: conversationId.data, beforeSequence: null });
}

// Founderhall titles a thread with the other member's name.
export async function generateMetadata({ params }: ConversationPageProps): Promise<Metadata> {
  const page = await readPage((await params).conversationId);
  return { title: page?.peer.name ?? PAGE_TITLES.messages };
}

export default modulePage(messagesManifest, async function ConversationPage({ params }: ConversationPageProps) {
  const [page, community] = await Promise.all([readPage((await params).conversationId), readBrandingForPage()]);
  if (!page) notFound();

  const queryClient = new QueryClient();
  queryClient.setQueryData(threadQuery(page.conversationId).queryKey, { pages: [page], pageParams: [null] });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Thread conversationId={page.conversationId} communityName={community.name} />
    </HydrationBoundary>
  );
});
