import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { getDatabase } from "@/database/client";
import { conversationIdSchema } from "@/lib/messages/message-api";
import { threadQuery } from "@/lib/messages/message-queries";
import { readThreadPage } from "@/lib/messages/message-reads";
import { requireMember } from "@/lib/session";

import { Thread } from "../thread";

type ConversationPageProps = { params: Promise<{ conversationId: string }> };

export default async function ConversationPage({ params }: ConversationPageProps) {
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
}
