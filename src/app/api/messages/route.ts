import { inboxBodySchema } from "@/lib/messages/message-api";
import { readInbox } from "@/lib/messages/message-reads";
import { enforceMessagingLimit, MESSAGING_KINDS } from "@/lib/messages/sending-limit";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-inbox", inboxBodySchema, async ({ database, member }, body) => {
  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.poll);
  return Response.json(await readInbox(database, member.id, body));
});
