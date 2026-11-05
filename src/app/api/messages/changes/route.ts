import { conversationGoneError } from "@/lib/messages/message-actions";
import { threadChangesBodySchema } from "@/lib/messages/message-api";
import { readThreadChanges } from "@/lib/messages/message-reads";
import { enforceMessagingLimit, MESSAGING_KINDS } from "@/lib/messages/sending-limit";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-changes", threadChangesBodySchema, async ({ database, member }, body) => {
  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.poll);
  const changes = await readThreadChanges(database, { viewerId: member.id, ...body });
  if (!changes) throw conversationGoneError();
  return Response.json(changes);
});
