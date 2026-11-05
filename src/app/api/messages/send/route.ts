import { sendMessage } from "@/lib/messages/message-actions";
import { sendMessageBodySchema } from "@/lib/messages/message-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("messages-send", sendMessageBodySchema, async (context, body) =>
  Response.json(await sendMessage(context, body)),
);
