import { reportMessage } from "@/lib/messages/message-actions";
import { messageIdBodySchema } from "@/lib/messages/message-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("messages-report", messageIdBodySchema, async (context, { messageId }) => {
  await reportMessage(context, messageId);
  return Response.json({ message: "Reported." });
});
