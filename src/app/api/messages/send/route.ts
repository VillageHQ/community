import { sendMessage } from "@/modules/messages/service";
import { sendMessageBodySchema } from "@/modules/messages/contract";
import { messagesRoutes } from "@/modules/messages/routes";

export const POST = messagesRoutes.member("messages-send", sendMessageBodySchema, async (context, body) =>
  Response.json(await sendMessage(context, body)),
);
