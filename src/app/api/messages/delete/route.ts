import { deleteOwnMessage } from "@/modules/messages/service";
import { messageIdBodySchema } from "@/modules/messages/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-delete", messageIdBodySchema, async (context, { messageId }) =>
  Response.json(await deleteOwnMessage(context, messageId)),
);
