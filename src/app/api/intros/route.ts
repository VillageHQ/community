import { emptyBodySchema } from "@/platform/http/contract";
import { enforceIntroLimit, INTRO_LIMIT_KINDS } from "@/modules/intros/limits";
import { readIntroBoard } from "@/modules/intros/reads";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("intros-board", emptyBodySchema, async ({ database, member }) => {
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.read);
  return Response.json(await readIntroBoard(database, member.id));
});
