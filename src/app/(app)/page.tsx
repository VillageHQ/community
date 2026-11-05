import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getDatabase } from "@/platform/database/client";
import { readSetupProgress } from "@/lib/admin-setup";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readFirstName } from "@/platform/design/avatar-identity";
import { readResendConfig } from "@/platform/email/resend";
import { readFeedPage } from "@/lib/feed/feed-reads";
import { readWaitingIntros } from "@/lib/intros/intro-reads";
import { readNewMembers } from "@/modules/members/reads-directory";
import { describeEmailConfirmation } from "@/modules/members/contract-email-confirmation-copy";
import { resolveOnboardingStep } from "@/shell/onboarding";
import { isCardFilledIn, readAvatarUrl, readMemberProfile } from "@/modules/members/service-profile";
import { ONBOARDING_STEPS } from "@/modules/members/contract-profile";
import { selectNextSteps } from "@/lib/next-steps";
import { ROUTES } from "@/platform/http/routes";
import { requireMember } from "@/platform/auth/session";
import { isAdminMember } from "@/platform/auth/roles";
import { readNetworkProgress } from "@/lib/village/network-progress";

import { Feed } from "./feed/feed";
import { feedQuery } from "./feed/feed-queries";
import { NewThisWeekCard, NextStepCard, WaitingOnYouCard } from "./feed/feed-rail";

export const metadata: Metadata = { title: PAGE_TITLES.feed };

function readWeekSentence(newCount: number) {
  if (newCount === 0) return "Here's what's happening.";
  return newCount === 1 ? "1 new member joined this week." : `${newCount} new members joined this week.`;
}

export default async function FeedPage() {
  const member = await requireMember();
  const database = getDatabase();
  if ((await resolveOnboardingStep(database, member)) !== ONBOARDING_STEPS.done) redirect(ROUTES.welcome);

  const isAdmin = isAdminMember(member);
  const [community, networkProgress, setupProgress, { newCount, newMembers }, profile, avatarUrl, feedPage, waitingIntros] =
    await Promise.all([
      readBrandingForPage(),
      readNetworkProgress(database, member),
      isAdmin ? readSetupProgress(database, process.env) : null,
      readNewMembers(database, member.id),
      readMemberProfile(database, member.id),
      readAvatarUrl(database, member.id),
      readFeedPage(database, member, null),
      readWaitingIntros(database, member.id),
    ]);

  const nextSteps = selectNextSteps({
    setupProgress,
    networkProgress,
    communityName: community.isSaved ? community.name : "your community",
    isCardFilled: profile !== null && isCardFilledIn(profile),
    confirmationCopy: describeEmailConfirmation(
      community.isSaved ? community.name : "your admin",
      readResendConfig(process.env) !== null,
    ),
  });

  const queryClient = new QueryClient();
  queryClient.setQueryData(feedQuery().queryKey, { pages: [feedPage], pageParams: [null] });

  return (
    <>
      <PageHeader title={`Good to see you, ${readFirstName(member.name)}.`} description={readWeekSentence(newCount)} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_296px] lg:gap-7">
        <div className="grid gap-5">
          {nextSteps
            .filter(({ isUrgent }) => isUrgent)
            .map((nextStep) => (
              <div key={nextStep.title} className="lg:hidden">
                <NextStepCard nextStep={nextStep} />
              </div>
            ))}
          {waitingIntros.length > 0 ? (
            <div className="lg:hidden">
              <WaitingOnYouCard intros={waitingIntros} />
            </div>
          ) : null}
          <HydrationBoundary state={dehydrate(queryClient)}>
            <Feed viewer={{ id: member.id, name: member.name, avatarUrl, isAdmin }} />
          </HydrationBoundary>
        </div>
        <aside aria-label="For you" className="grid gap-5 lg:sticky lg:top-9">
          {waitingIntros.length > 0 ? (
            <div className="max-lg:hidden">
              <WaitingOnYouCard intros={waitingIntros} />
            </div>
          ) : null}
          {nextSteps.map((nextStep) => (
            <div key={nextStep.title} className={nextStep.isUrgent ? "max-lg:hidden" : undefined}>
              <NextStepCard nextStep={nextStep} />
            </div>
          ))}
          <NewThisWeekCard newMembers={newMembers} />
        </aside>
      </div>
    </>
  );
}
