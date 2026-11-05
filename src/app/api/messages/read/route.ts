import { markConversationRead } from "@/modules/messages/service";
import { markReadBodySchema } from "@/modules/messages/contract";
import { messagesRoutes } from "@/modules/messages/routes";

export const POST = messagesRoutes.member("messages-read", markReadBodySchema, async (context, body) =>
  Response.json(await markConversationRead(context, body)),
);
