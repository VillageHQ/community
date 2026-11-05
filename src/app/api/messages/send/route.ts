import { sendMessage } from "@/modules/messages/service";
import { sendMessageBodySchema } from "@/modules/messages/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-send", sendMessageBodySchema, async (context, body) =>
  Response.json(await sendMessage(context, body)),
);
