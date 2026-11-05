import { markIntrosSeenBodySchema } from "@/modules/intros/contract";
import { markIntrosSeen } from "@/modules/intros/reads";
import { createMemberRoute } from "@/platform/village/member-routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";

export const POST = createMemberRoute("intros-seen", markIntrosSeenBodySchema, async ({ database, member }, { introId }) => {
  await markIntrosSeen(database, member.id, introId);
  return Response.json(acknowledgedResponseSchema.parse({ message: "Seen." }));
});
