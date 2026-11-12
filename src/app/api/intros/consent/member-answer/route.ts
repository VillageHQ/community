import { targetMemberAnswerBodySchema } from "@/modules/intros/contract";
import { introsRoutes } from "@/modules/intros/routes";
import { answerAsTargetMember } from "@/modules/intros/service-consent";

// A member who is the person asked for answers in the app (Today, Your intros), not only by the emailed link.
export const POST = introsRoutes.member("intros-target-member-answer", targetMemberAnswerBodySchema, async (context, body) =>
  Response.json(await answerAsTargetMember(context, body)),
);
