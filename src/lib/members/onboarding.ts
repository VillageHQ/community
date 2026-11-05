import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { memberProfile } from "../../database/members-schema.ts";
import type { SessionMember } from "../village/member-network.ts";
import { NETWORK_PROGRESS, readNetworkProgress } from "../village/network-progress.ts";
import type { NetworkProgress } from "../village/network-progress-stages.ts";
import { ONBOARDING_STEPS, type OnboardingStep } from "./profile-api.ts";

const PROGRESS_THAT_ASKS_TO_SHARE: ReadonlySet<NetworkProgress> = new Set([
  NETWORK_PROGRESS.needsEmailConfirmation,
  NETWORK_PROGRESS.needsLinkedin,
  NETWORK_PROGRESS.needsConsent,
]);

export async function completeOnboarding(database: Database, memberId: string) {
  const now = new Date();
  await database
    .update(memberProfile)
    .set({ onboardingCompletedAt: now, updatedAt: now })
    .where(and(eq(memberProfile.userId, memberId), isNull(memberProfile.onboardingCompletedAt)));
}

export async function completeCardStep(database: Database, memberId: string) {
  const now = new Date();
  await database
    .update(memberProfile)
    .set({ cardStepDoneAt: now, updatedAt: now })
    .where(and(eq(memberProfile.userId, memberId), isNull(memberProfile.cardStepDoneAt)));
}

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
