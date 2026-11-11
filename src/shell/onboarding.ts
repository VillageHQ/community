import "server-only";

import { eq } from "drizzle-orm";

import type { Database } from "../platform/database/client.ts";
import { isModuleEnabled } from "../platform/modules/enablement.ts";
import type { RequestContext, SessionMember } from "../platform/http/request-context.ts";
import { isAdminMember } from "../platform/auth/roles.ts";
import { ROUTES } from "../platform/http/routes.ts";
import { memberProfile } from "../modules/members/schema.ts";
import { ONBOARDING_STEPS, type OnboardingStep } from "../modules/members/contract-profile.ts";
import { completeCardStep, completeOnboarding } from "../modules/members/service-onboarding.ts";
import { saveProfile } from "../modules/members/service-profile.ts";
import { CHOICE_PLACES } from "../modules/members/contract-privacy.ts";
import { savePrivacy, saveIntroAsksAnswer } from "../modules/members/service-privacy.ts";
import { readFillInSettings, saveLookupChoice } from "../modules/members/service-fill-in.ts";
import { introsManifest } from "../modules/intros/manifest.ts";
import type { WelcomeAboutBody, WelcomePrivacyBody } from "./welcome-steps.ts";

// Founderhall's two welcome steps: the card (step 1, `card`), then privacy (step 2, `introAsks`), then done.
// Sharing a network is no longer a step: it waits on the network page.
export async function resolveOnboardingStep(database: Database, member: SessionMember): Promise<OnboardingStep> {
  const [profile] = await database
    .select({ cardStepDoneAt: memberProfile.cardStepDoneAt, onboardingCompletedAt: memberProfile.onboardingCompletedAt })
    .from(memberProfile)
    .where(eq(memberProfile.userId, member.id));
  if (!profile || profile.onboardingCompletedAt) return ONBOARDING_STEPS.done;
  if (!profile.cardStepDoneAt) return ONBOARDING_STEPS.card;
  return ONBOARDING_STEPS.introAsks;
}

// What step 2 shows: the intro switch while intros are on, the lookup switch while profile fill-in is on.
export async function readWelcomePrivacyOptions(database: Database) {
  const [isIntrosOn, fillIn] = await Promise.all([isModuleEnabled(database, introsManifest), readFillInSettings(database)]);
  return { isIntrosOn, isLookupOn: fillIn.basis !== null };
}

// Step 1: the name and the card's words, then on to step 2.
export async function saveWelcomeAbout(context: RequestContext, { name, workingOn, canHelpWith, role, company, city }: WelcomeAboutBody) {
  await saveProfile(context, { name, bio: workingOn, canHelpWith, title: role, company, location: city });
  await completeCardStep(context.database, context.member.id);
}

// Step 2: every choice, each in its own consent record, then onboarding is done. Returns where to go next.
export async function finishWelcome(database: Database, member: SessionMember, body: WelcomePrivacyBody) {
  const { isIntrosOn, isLookupOn } = await readWelcomePrivacyOptions(database);
  await savePrivacy(database, member.id, { isHidden: body.isHidden });
  if (isIntrosOn) await saveIntroAsksAnswer(database, member.id, body.acceptsIntroAsks ?? true, CHOICE_PLACES.onboarding);
  if (isLookupOn && body.allowsLookup !== undefined) await saveLookupChoice(database, member.id, body.allowsLookup);
  await completeOnboarding(database, member.id);
  return isAdminMember(member) ? ROUTES.admin : ROUTES.members;
}
