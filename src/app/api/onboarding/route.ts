import { completeCardStep, completeOnboarding } from "@/modules/members/service-onboarding";
import { ONBOARDING_STEPS, onboardingBodySchema } from "@/modules/members/contract-profile";
import { membersRoutes } from "@/modules/members/routes";
import { hasAnsweredIntroAsks } from "@/modules/members/service-privacy";
import { introsManifest } from "@/modules/intros/manifest";
import { RequestError } from "@/platform/http/request-error";
import { isModuleEnabled } from "@/platform/modules/enablement";

const CONFLICT_STATUS = 409;

export const POST = membersRoutes.member("onboarding-advance", onboardingBodySchema, async ({ database, member }, { step }) => {
  if (step === ONBOARDING_STEPS.card) {
    await completeCardStep(database, member.id);
    return Response.json({ message: "Saved." });
  }
  // "Accept intro asks?" has no default, so finishing onboarding waits for an answer while intros are on.
  if ((await isModuleEnabled(database, introsManifest)) && !(await hasAnsweredIntroAsks(database, member.id))) {
    throw new RequestError(CONFLICT_STATUS, "intro_asks_unanswered", "Say whether members can ask you for intros first.");
  }
  await completeOnboarding(database, member.id);
  return Response.json({ message: "Saved." });
});
