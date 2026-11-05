import { saveProfile } from "@/modules/members/service-profile";
import { profileBodySchema } from "@/modules/members/contract-profile";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("profile-save", profileBodySchema, async (context, body) => {
  await saveProfile(context, body);
  return Response.json({ message: "Your card is saved." });
});
