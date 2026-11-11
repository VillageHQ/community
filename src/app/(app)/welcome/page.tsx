import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readBrandingForPage } from "@/platform/branding/branding";
import { resolveOnboardingStep } from "@/shell/onboarding";
import { readMemberProfile } from "@/modules/members/service-profile";
import { ONBOARDING_STEPS } from "@/modules/members/contract-profile";
import { ROUTES } from "@/platform/http/routes";
import { requireMember } from "@/platform/auth/session";
import { membersManifest } from "@/modules/members/manifest";
import { modulePage } from "@/platform/modules/module-page";

import { AboutForm } from "./about-form";
import { WelcomeStepsHead } from "./welcome-steps-head";

export const metadata: Metadata = { title: PAGE_TITLES.welcome };

// Until step 1 is saved, an accepted invite carries the start of the address as the name: the field starts empty.
function readStartingName(name: string, email: string) {
  return name === email.split("@")[0] ? "" : name;
}

// Founderhall's welcome step 1 of 2 (views-member.mjs welcomePage, step 1), inside the member shell.
export default modulePage(membersManifest, async function WelcomePage() {
  const member = await requireMember();
  const database = getDatabase();
  const step = await resolveOnboardingStep(database, member);
  // Back to the landing, which sends a new admin on to setup.
  if (step === ONBOARDING_STEPS.done) redirect(ROUTES.landing);

  const [community, profile] = await Promise.all([readBrandingForPage(), readMemberProfile(database, member.id)]);

  return (
    <div className="fh-narrow">
      <WelcomeStepsHead current="about" />
      <h1 className="fh-h1">Welcome to {community.name}</h1>
      <p className="fh-lede">Two questions, so members know what you do and how you can help. Change anything later.</p>
      <AboutForm
        initialValues={{
          name: readStartingName(member.name, member.email),
          workingOn: profile?.bio ?? "",
          canHelpWith: profile?.canHelpWith ?? "",
          role: profile?.title ?? "",
          company: profile?.company ?? "",
          city: profile?.location ?? "",
        }}
      />
    </div>
  );
});
