import { conversationGoneError } from "@/modules/messages/service";
import { threadPageBodySchema } from "@/modules/messages/contract";
import { readThreadPage } from "@/modules/messages/reads";
import { enforceMessagingLimit, MESSAGING_KINDS } from "@/modules/messages/limits";
import { messagesRoutes } from "@/modules/messages/routes";

export const POST = messagesRoutes.member("messages-thread", threadPageBodySchema, async ({ database, member }, body) => {
  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.poll);
  const page = await readThreadPage(database, { viewerId: member.id, ...body });
  if (!page) throw conversationGoneError();
  return Response.json(page);
});
