import { emptyBodySchema } from "@/platform/http/contract";
import { enforceIntroLimit, INTRO_LIMIT_KINDS } from "@/modules/intros/limits";
import { readIntroBoard } from "@/modules/intros/reads";
import { introsRoutes } from "@/modules/intros/routes";

export const POST = introsRoutes.member("intros-board", emptyBodySchema, async ({ database, member }) => {
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.read);
  return Response.json(await readIntroBoard(database, member.id));
});
