import { emptyBodySchema } from "@/platform/http/contract";
import { readUnreadCount } from "@/lib/messages/message-reads";
import { enforceMessagingLimit, MESSAGING_KINDS } from "@/lib/messages/sending-limit";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-unread-count", emptyBodySchema, async ({ database, member }) => {
  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.poll);
  return Response.json({ unreadCount: await readUnreadCount(database, member.id) });
});
