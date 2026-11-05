import { reportMessage } from "@/lib/messages/message-actions";
import { messageIdBodySchema } from "@/lib/messages/message-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-report", messageIdBodySchema, async (context, { messageId }) => {
  return Response.json({ message: await reportMessage(context, messageId) });
});
