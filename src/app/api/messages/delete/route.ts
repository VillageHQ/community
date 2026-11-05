import { deleteOwnMessage } from "@/lib/messages/message-actions";
import { messageIdBodySchema } from "@/lib/messages/message-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-delete", messageIdBodySchema, async (context, { messageId }) =>
  Response.json(await deleteOwnMessage(context, messageId)),
);
