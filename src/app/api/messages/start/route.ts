import { startConversation } from "@/lib/messages/message-actions";
import { startConversationBodySchema } from "@/lib/messages/message-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-start", startConversationBodySchema, async (context, { memberId }) =>
  Response.json(await startConversation(context, memberId)),
);
