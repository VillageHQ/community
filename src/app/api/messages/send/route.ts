import { sendMessage } from "@/lib/messages/message-actions";
import { sendMessageBodySchema } from "@/lib/messages/message-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-send", sendMessageBodySchema, async (context, body) =>
  Response.json(await sendMessage(context, body)),
);
