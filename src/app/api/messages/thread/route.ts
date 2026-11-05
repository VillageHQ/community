import { conversationGoneError } from "@/lib/messages/message-actions";
import { threadPageBodySchema } from "@/lib/messages/message-api";
import { readThreadPage } from "@/lib/messages/message-reads";
import { enforceMessagingLimit, MESSAGING_KINDS } from "@/lib/messages/sending-limit";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-thread", threadPageBodySchema, async ({ database, member }, body) => {
  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.poll);
  const page = await readThreadPage(database, { viewerId: member.id, ...body });
  if (!page) throw conversationGoneError();
  return Response.json(page);
});
