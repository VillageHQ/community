import { inboxBodySchema } from "@/modules/messages/contract";
import { readInbox } from "@/modules/messages/reads";
import { enforceMessagingLimit, MESSAGING_KINDS } from "@/modules/messages/limits";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-inbox", inboxBodySchema, async ({ database, member }, body) => {
  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.poll);
  return Response.json(await readInbox(database, member.id, body));
});
