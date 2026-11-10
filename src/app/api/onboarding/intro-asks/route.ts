import { CHOICE_PLACES, introAsksAnswerBodySchema } from "@/modules/members/contract-privacy";
import { membersRoutes } from "@/modules/members/routes";
import { saveIntroAsksAnswer } from "@/modules/members/service-privacy";

export const POST = membersRoutes.member("onboarding-intro-asks", introAsksAnswerBodySchema, async ({ database, member }, { acceptsIntroAsks }) => {
  await saveIntroAsksAnswer(database, member.id, acceptsIntroAsks, CHOICE_PLACES.onboarding);
  return Response.json({ message: acceptsIntroAsks ? "Thanks. Members can ask you for intros." : "Done. Nobody can ask you for intros." });
});
