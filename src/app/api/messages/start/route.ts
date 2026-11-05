import { startConversation } from "@/lib/messages/message-actions";
import { startConversationBodySchema } from "@/lib/messages/message-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("messages-start", startConversationBodySchema, async (context, { memberId }) =>
  Response.json(await startConversation(context, memberId)),
);
