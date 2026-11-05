import { markConversationRead } from "@/modules/messages/service";
import { markReadBodySchema } from "@/modules/messages/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-read", markReadBodySchema, async (context, body) =>
  Response.json(await markConversationRead(context, body)),
);
