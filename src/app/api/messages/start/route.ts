import { startConversation } from "@/modules/messages/service";
import { startConversationBodySchema } from "@/modules/messages/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-start", startConversationBodySchema, async (context, { memberId }) =>
  Response.json(await startConversation(context, memberId)),
);
