import { emptyBodySchema } from "@/lib/messages/message-api";
import { enforceIntroLimit, INTRO_LIMIT_KINDS } from "@/lib/intros/intro-limit";
import { readIntroBoard } from "@/lib/intros/intro-reads";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("intros-board", emptyBodySchema, async ({ database, member }) => {
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.read);
  return Response.json(await readIntroBoard(database, member.id));
});
