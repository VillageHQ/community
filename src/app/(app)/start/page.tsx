import { redirect } from "next/navigation";

import { getDatabase } from "@/database/client";
import { readSetupProgress } from "@/lib/admin-setup";
import { resolveOnboardingStep } from "@/lib/members/onboarding";
import { ONBOARDING_STEPS } from "@/lib/members/profile-api";
import { ROUTES } from "@/lib/routes";
import { requireMember } from "@/lib/session";
import { isAdminMember } from "@/lib/village/member-network";

export default async function LandingPage() {
  const member = await requireMember();
  const database = getDatabase();
  if ((await resolveOnboardingStep(database, member)) !== ONBOARDING_STEPS.done) redirect(ROUTES.welcome);
  if (!isAdminMember(member)) redirect(ROUTES.feed);

  const { isComplete } = await readSetupProgress(database, process.env);
  redirect(isComplete ? ROUTES.feed : ROUTES.admin);
}
