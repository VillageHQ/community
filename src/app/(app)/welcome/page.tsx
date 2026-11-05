import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readInviterOfMember } from "@/modules/members/service-invites";
import { readActiveMemberCount, readMemberNeighbours } from "@/modules/members/reads-directory";
import { resolveOnboardingStep } from "@/shell/onboarding";
import { readMemberProfile } from "@/modules/members/service-profile";
import { ONBOARDING_STEPS } from "@/modules/members/contract-profile";
import { ROUTES } from "@/platform/http/routes";
import { requireMember } from "@/platform/auth/session";
import { NETWORK_PROGRESS, readNetworkProgress } from "@/modules/network/reads-progress";

import { ConsentStep } from "@/modules/network/components/consent-step";
import { LinkedinWelcome } from "@/modules/network/components/linkedin-step";
import { loadWelcomeContext } from "@/shell/load-welcome-context";
import { CardStep } from "@/modules/members/components/card-step";
import { ConfirmationStep } from "@/modules/members/components/confirmation-step";

export const metadata: Metadata = { title: PAGE_TITLES.welcome };

export default async function WelcomePage() {
  const member = await requireMember();
  const database = getDatabase();
  const step = await resolveOnboardingStep(database, member);
  if (step === ONBOARDING_STEPS.done) redirect(ROUTES.feed);

  const [context, inviter, profile, progress, memberNeighbours, memberCount] = await Promise.all([
    loadWelcomeContext(database, member),
    readInviterOfMember(database, member.id),
    readMemberProfile(database, member.id),
    readNetworkProgress(database, member),
    readMemberNeighbours(database, member.id),
    readActiveMemberCount(database),
  ]);
  const welcome = { ...context, neighbours: memberNeighbours, isOnboarding: true, inviter };

  if (step === ONBOARDING_STEPS.card && profile) {
    return <CardStep welcome={welcome} profile={profile} memberCount={memberCount} />;
  }
  if (progress === NETWORK_PROGRESS.needsEmailConfirmation) return <ConfirmationStep welcome={welcome} />;
  if (progress === NETWORK_PROGRESS.needsLinkedin) return <LinkedinWelcome welcome={welcome} />;
  return <ConsentStep welcome={welcome} />;
}
