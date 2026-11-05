import { saveProfile } from "@/lib/members/profile";
import { profileBodySchema } from "@/lib/members/profile-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("profile-save", profileBodySchema, async (context, body) => {
  await saveProfile(context, body);
  return Response.json({ message: "Your card is saved." });
});
