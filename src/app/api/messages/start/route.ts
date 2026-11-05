import { startConversation } from "@/modules/messages/service";
import { startConversationBodySchema } from "@/modules/messages/contract";
import { messagesRoutes } from "@/modules/messages/routes";

export const POST = messagesRoutes.member("messages-start", startConversationBodySchema, async (context, { memberId }) =>
  Response.json(await startConversation(context, memberId)),
);
