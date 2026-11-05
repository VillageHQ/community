import { emptyBodySchema } from "@/lib/messages/message-api";
import { readUnreadCount } from "@/lib/messages/message-reads";
import { enforceMessagingLimit, MESSAGING_KINDS } from "@/lib/messages/sending-limit";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("messages-unread-count", emptyBodySchema, async ({ database, member }) => {
  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.poll);
  return Response.json({ unreadCount: await readUnreadCount(database, member.id) });
});
