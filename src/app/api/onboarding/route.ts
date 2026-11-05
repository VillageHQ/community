import { completeCardStep, completeOnboarding } from "@/modules/members/service-onboarding";
import { ONBOARDING_STEPS, onboardingBodySchema } from "@/modules/members/contract-profile";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("onboarding-advance", onboardingBodySchema, async ({ database, member }, { step }) => {
  const completeStep = step === ONBOARDING_STEPS.card ? completeCardStep : completeOnboarding;
  await completeStep(database, member.id);
  return Response.json({ message: "Saved." });
});
