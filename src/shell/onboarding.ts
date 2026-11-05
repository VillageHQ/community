import "server-only";

import { eq } from "drizzle-orm";

import type { Database } from "../platform/database/client.ts";
import { memberProfile } from "../modules/members/schema.ts";
import type { SessionMember } from "../platform/http/request-context.ts";
import { NETWORK_PROGRESS, readNetworkProgress } from "../lib/village/network-progress.ts";
import type { NetworkProgress } from "../lib/village/network-progress-stages.ts";
import { ONBOARDING_STEPS, type OnboardingStep } from "../modules/members/contract-profile.ts";
import { completeOnboarding } from "../modules/members/service-onboarding.ts";

const PROGRESS_THAT_ASKS_TO_SHARE: ReadonlySet<NetworkProgress> = new Set([
  NETWORK_PROGRESS.needsEmailConfirmation,
  NETWORK_PROGRESS.needsLinkedin,
  NETWORK_PROGRESS.needsConsent,
]);

export async function resolveOnboardingStep(database: Database, member: SessionMember): Promise<OnboardingStep> {
  const [profile] = await database
    .select({ cardStepDoneAt: memberProfile.cardStepDoneAt, onboardingCompletedAt: memberProfile.onboardingCompletedAt })
    .from(memberProfile)
    .where(eq(memberProfile.userId, member.id));
  if (!profile || profile.onboardingCompletedAt) return ONBOARDING_STEPS.done;
  if (!profile.cardStepDoneAt) return ONBOARDING_STEPS.card;

  if (PROGRESS_THAT_ASKS_TO_SHARE.has(await readNetworkProgress(database, member))) return ONBOARDING_STEPS.network;

  await completeOnboarding(database, member.id);
  return ONBOARDING_STEPS.done;
}
