import { deleteOwnMessage } from "@/modules/messages/service";
import { messageIdBodySchema } from "@/modules/messages/contract";
import { messagesRoutes } from "@/modules/messages/routes";

export const POST = messagesRoutes.member("messages-delete", messageIdBodySchema, async (context, { messageId }) =>
  Response.json(await deleteOwnMessage(context, messageId)),
);
