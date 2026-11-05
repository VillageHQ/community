import { conversationGoneError } from "@/modules/messages/service";
import { threadChangesBodySchema } from "@/modules/messages/contract";
import { readThreadChanges } from "@/modules/messages/reads";
import { enforceMessagingLimit, MESSAGING_KINDS } from "@/modules/messages/limits";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-changes", threadChangesBodySchema, async ({ database, member }, body) => {
  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.poll);
  const changes = await readThreadChanges(database, { viewerId: member.id, ...body });
  if (!changes) throw conversationGoneError();
  return Response.json(changes);
});
