import { markConversationRead } from "@/lib/messages/message-actions";
import { markReadBodySchema } from "@/lib/messages/message-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("messages-read", markReadBodySchema, async (context, body) =>
  Response.json(await markConversationRead(context, body)),
);
