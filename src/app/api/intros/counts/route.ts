import { enforceIntroLimit, INTRO_LIMIT_KINDS } from "@/modules/intros/limits";
import { readIntroCounts } from "@/modules/intros/reads";
import { emptyBodySchema } from "@/platform/http/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("intros-counts", emptyBodySchema, async ({ database, member }) => {
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.read);
  return Response.json(await readIntroCounts(database, member.id));
});
