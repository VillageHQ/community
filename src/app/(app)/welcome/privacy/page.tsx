import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readBrandingForPage } from "@/platform/branding/branding";
import { readWelcomePrivacyOptions, resolveOnboardingStep } from "@/shell/onboarding";
import { ONBOARDING_STEPS } from "@/modules/members/contract-profile";
import { readPrivacy } from "@/modules/members/service-privacy";
import { readLookupState } from "@/modules/members/service-fill-in";
import { ROUTES } from "@/platform/http/routes";
import { requireMember } from "@/platform/auth/session";
import { membersManifest } from "@/modules/members/manifest";
import { modulePage } from "@/platform/modules/module-page";

import { PrivacyForm } from "../privacy-form";
import { WelcomeStepsHead } from "../welcome-steps-head";

export const metadata: Metadata = { title: PAGE_TITLES.welcome };

// Founderhall's welcome step 2 of 2, "Your privacy". Each switch starts on, as Founderhall's do; a member who
// already chose keeps their choice.
export default modulePage(membersManifest, async function WelcomePrivacyPage() {
  const member = await requireMember();
  const database = getDatabase();
  const step = await resolveOnboardingStep(database, member);
  if (step === ONBOARDING_STEPS.done) redirect(ROUTES.landing);
  if (step === ONBOARDING_STEPS.card) redirect(ROUTES.welcome);

  const [community, options, privacy, lookup] = await Promise.all([
    readBrandingForPage(),
    readWelcomePrivacyOptions(database),
    readPrivacy(database, member.id),
    readLookupState(database, member.id),
  ]);

  return (
    <div className="fh-narrow">
      <WelcomeStepsHead current="privacy" />
      <h1 className="fh-h1">Your privacy</h1>
      <p className="fh-lede">Who sees you, and whether members can ask you for intros.</p>
      <PrivacyForm
        communityName={community.name}
        isIntrosOn={options.isIntrosOn}
        isLookupOn={options.isLookupOn}
        initial={{ isHidden: privacy.isHidden, acceptsIntroAsks: privacy.acceptsIntroAsks !== false, allowsLookup: !lookup.refusedAt }}
      />
    </div>
  );
});
