import { setMemberBlocked } from "@/lib/messages/message-actions";
import { setBlockBodySchema } from "@/lib/messages/message-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("messages-block", setBlockBodySchema, async (context, body) =>
  Response.json(await setMemberBlocked(context, body)),
);
