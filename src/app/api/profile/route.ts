import { saveProfile } from "@/modules/members/service-profile";
import { profileBodySchema } from "@/modules/members/contract-profile";
import { membersRoutes } from "@/modules/members/routes";

export const POST = membersRoutes.member("profile-save", profileBodySchema, async (context, body) => {
  await saveProfile(context, body);
  return Response.json({ message: "Your card is saved." });
});
