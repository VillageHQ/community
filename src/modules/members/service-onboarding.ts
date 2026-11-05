import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { memberProfile } from "./schema.ts";

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
