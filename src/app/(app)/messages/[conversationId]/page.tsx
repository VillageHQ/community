import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { getDatabase } from "@/platform/database/client";
import { conversationIdSchema } from "@/modules/messages/contract";
import { threadQuery } from "@/modules/messages/queries";
import { readThreadPage } from "@/modules/messages/reads";
import { requireMember } from "@/platform/auth/session";

import { Thread } from "@/modules/messages/components/thread";
import { messagesManifest } from "@/modules/messages/manifest";
import { modulePage } from "@/platform/modules/module-page";

type ConversationPageProps = { params: Promise<{ conversationId: string }> };

export default modulePage(messagesManifest, async function ConversationPage({ params }: ConversationPageProps) {
  const member = await requireMember();
  const { conversationId: requestedId } = await params;
  const conversationId = conversationIdSchema.safeParse(requestedId);
  if (!conversationId.success) notFound();

  const page = await readThreadPage(getDatabase(), {
    viewerId: member.id,
    conversationId: conversationId.data,
    beforeSequence: null,
  });
  if (!page) notFound();

  const queryClient = new QueryClient();
  queryClient.setQueryData(threadQuery(conversationId.data).queryKey, { pages: [page], pageParams: [null] });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Thread conversationId={conversationId.data} />
    </HydrationBoundary>
  );
});
