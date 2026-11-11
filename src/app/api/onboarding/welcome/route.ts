import { membersRoutes } from "@/modules/members/routes";
import { saveWelcomeAbout } from "@/shell/onboarding";
import { welcomeAboutBodySchema } from "@/shell/welcome-steps";

// Welcome step 1 ("Welcome to …"): the name and the card's words.
export const POST = membersRoutes.member("onboarding-welcome", welcomeAboutBodySchema, async (context, body) => {
  await saveWelcomeAbout(context, body);
  return Response.json({ message: "Saved." });
});
