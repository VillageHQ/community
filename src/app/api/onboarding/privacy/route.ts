import { membersRoutes } from "@/modules/members/routes";
import { finishWelcome } from "@/shell/onboarding";
import { welcomePrivacyBodySchema } from "@/shell/welcome-steps";

// Welcome step 2 ("Your privacy"): the choices, then onboarding is done. Answers where to go next.
export const POST = membersRoutes.member("onboarding-privacy", welcomePrivacyBodySchema, async ({ database, member }, body) => {
  return Response.json({ next: await finishWelcome(database, member, body) });
});
