import { markIntrosSeenBodySchema } from "@/modules/intros/contract";
import { markIntrosSeen } from "@/modules/intros/reads";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { introsRoutes } from "@/modules/intros/routes";

export const POST = introsRoutes.member("intros-seen", markIntrosSeenBodySchema, async ({ database, member }, { introId }) => {
  await markIntrosSeen(database, member.id, introId);
  return Response.json(acknowledgedResponseSchema.parse({ message: "Seen." }));
});
