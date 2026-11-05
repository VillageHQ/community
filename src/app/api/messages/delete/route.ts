import { deleteOwnMessage } from "@/lib/messages/message-actions";
import { messageIdBodySchema } from "@/lib/messages/message-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("messages-delete", messageIdBodySchema, async (context, { messageId }) =>
  Response.json(await deleteOwnMessage(context, messageId)),
);
