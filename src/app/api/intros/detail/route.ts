import { introGoneError } from "@/lib/intros/intro-actions";
import { introIdBodySchema } from "@/lib/intros/intro-api";
import { enforceIntroLimit, INTRO_LIMIT_KINDS } from "@/lib/intros/intro-limit";
import { readIntroForViewer } from "@/lib/intros/intro-reads";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("intros-detail", introIdBodySchema, async ({ database, member }, { introId }) => {
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.read);
  const intro = await readIntroForViewer(database, member.id, introId);
  if (!intro) throw introGoneError();
  return Response.json(intro);
});
