import { markIntrosSeenBodySchema } from "@/lib/intros/intro-api";
import { markIntrosSeen } from "@/lib/intros/intro-reads";
import { createMemberRoute } from "@/lib/village/member-route";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";

export const POST = createMemberRoute("intros-seen", markIntrosSeenBodySchema, async ({ database, member }, { introId }) => {
  await markIntrosSeen(database, member.id, introId);
  return Response.json(acknowledgedResponseSchema.parse({ message: "Seen." }));
});
