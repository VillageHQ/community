import { reportMessage } from "@/modules/messages/service";
import { messageIdBodySchema } from "@/modules/messages/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-report", messageIdBodySchema, async (context, { messageId }) => {
  return Response.json({ message: await reportMessage(context, messageId) });
});
