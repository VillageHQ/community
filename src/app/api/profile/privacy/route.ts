import { CHOICE_PLACES, privacyBodySchema } from "@/modules/members/contract-privacy";
import { membersRoutes } from "@/modules/members/routes";
import { saveIntroAsksAnswer, savePrivacy } from "@/modules/members/service-privacy";

export const POST = membersRoutes.member("profile-privacy", privacyBodySchema, async ({ database, member }, body) => {
  const { acceptsIntroAsks, ...switches } = body;
  await savePrivacy(database, member.id, switches);
  if (acceptsIntroAsks !== undefined) await saveIntroAsksAnswer(database, member.id, acceptsIntroAsks, CHOICE_PLACES.yourData);
  return Response.json({ message: "Saved." });
});
