import { markConversationRead } from "@/lib/messages/message-actions";
import { markReadBodySchema } from "@/lib/messages/message-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-read", markReadBodySchema, async (context, body) =>
  Response.json(await markConversationRead(context, body)),
);
