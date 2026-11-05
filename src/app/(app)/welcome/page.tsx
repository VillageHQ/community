import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getDatabase } from "@/database/client";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";
import { readInviterOfMember } from "@/lib/invites/invites";
import { readActiveMemberCount, readMemberNeighbours } from "@/lib/members/directory";
import { resolveOnboardingStep } from "@/lib/members/onboarding";
import { readMemberProfile } from "@/lib/members/profile";
import { ONBOARDING_STEPS } from "@/lib/members/profile-api";
import { ROUTES } from "@/lib/routes";
import { requireMember } from "@/lib/session";
import { NETWORK_PROGRESS, readNetworkProgress } from "@/lib/village/network-progress";

import { ConsentStep } from "../network/consent-step";
import { LinkedinWelcome } from "../network/linkedin-step";
import { loadWelcomeContext } from "../network/load-welcome-context";
import { CardStep } from "./card-step";
import { ConfirmationStep } from "./confirmation-step";

export const metadata: Metadata = { title: PAGE_TITLES.welcome };

export default async function WelcomePage() {
  const member = await requireMember();
  const database = getDatabase();
  const step = await resolveOnboardingStep(database, member);
  if (step === ONBOARDING_STEPS.done) redirect(ROUTES.home);

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
