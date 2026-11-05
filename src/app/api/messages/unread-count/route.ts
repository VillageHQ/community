import { emptyBodySchema } from "@/platform/http/contract";
import { readUnreadCount } from "@/modules/messages/reads";
import { enforceMessagingLimit, MESSAGING_KINDS } from "@/modules/messages/limits";
import { messagesRoutes } from "@/modules/messages/routes";

export const POST = messagesRoutes.member("messages-unread-count", emptyBodySchema, async ({ database, member }) => {
  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.poll);
  return Response.json({ unreadCount: await readUnreadCount(database, member.id) });
});
