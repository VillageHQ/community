import { inboxBodySchema } from "@/modules/messages/contract";
import { readInbox } from "@/modules/messages/reads";
import { enforceMessagingLimit, MESSAGING_KINDS } from "@/modules/messages/limits";
import { messagesRoutes } from "@/modules/messages/routes";

export const POST = messagesRoutes.member("messages-inbox", inboxBodySchema, async ({ database, member }, body) => {
  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.poll);
  return Response.json(await readInbox(database, member.id, body));
});
