import { enforceIntroLimit, INTRO_LIMIT_KINDS } from "@/lib/intros/intro-limit";
import { readIntroCounts } from "@/lib/intros/intro-reads";
import { emptyBodySchema } from "@/lib/messages/message-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("intros-counts", emptyBodySchema, async ({ database, member }) => {
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.read);
  return Response.json(await readIntroCounts(database, member.id));
});
