import { reportMessage } from "@/modules/messages/service";
import { messageIdBodySchema } from "@/modules/messages/contract";
import { messagesRoutes } from "@/modules/messages/routes";

export const POST = messagesRoutes.member("messages-report", messageIdBodySchema, async (context, { messageId }) => {
  return Response.json({ message: await reportMessage(context, messageId) });
});
