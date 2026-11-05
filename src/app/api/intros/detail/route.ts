import { introGoneError } from "@/modules/intros/service";
import { introIdBodySchema } from "@/modules/intros/contract";
import { enforceIntroLimit, INTRO_LIMIT_KINDS } from "@/modules/intros/limits";
import { readIntroForViewer } from "@/modules/intros/reads";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("intros-detail", introIdBodySchema, async ({ database, member }, { introId }) => {
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.read);
  const intro = await readIntroForViewer(database, member.id, introId);
  if (!intro) throw introGoneError();
  return Response.json(intro);
});
