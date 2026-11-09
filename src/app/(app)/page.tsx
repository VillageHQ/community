import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getDatabase } from "@/platform/database/client";
import { readSetupProgress } from "@/shell/admin-setup";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readFirstName } from "@/platform/design/avatar-identity";
import { readResendConfig } from "@/platform/email/resend";
import { readFeedPage } from "@/modules/feed/reads";
import { describeEmailConfirmation } from "@/modules/members/contract-email-confirmation-copy";
import { resolveOnboardingStep } from "@/shell/onboarding";
import { isCardFilledIn, readAvatarUrl, readMemberProfile } from "@/modules/members/service-profile";
import { ONBOARDING_STEPS } from "@/modules/members/contract-profile";
import { selectNextSteps } from "@/shell/next-steps";
import { ROUTES } from "@/platform/http/routes";
import { requireMember } from "@/platform/auth/session";
import { isAdminMember } from "@/platform/auth/roles";
import { readNetworkProgress } from "@/modules/network/reads-progress";

import { Feed } from "@/modules/feed/components/feed";
import { feedQuery } from "@/modules/feed/queries";
import { membersManifest } from "@/modules/members/manifest";
import { feedManifest } from "@/modules/feed/manifest";
import { networkManifest } from "@/modules/network/manifest";
import { readEnabledIds } from "@/shell/enabled-modules";
import { isTodayEmpty, readTodayItems, type TodayItems } from "@/shell/today";
import { TodayList } from "@/shell/today-list";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { modulePage } from "@/platform/modules/module-page";

export async function generateMetadata(): Promise<Metadata> {
  const isFeedOn = await isModuleEnabled(getDatabase(), feedManifest);
  return { title: isFeedOn ? PAGE_TITLES.feed : PAGE_TITLES.home };
}

function readWeekSentence(today: TodayItems) {
  return isTodayEmpty(today) ? "Nothing needs you this week." : "Here's what needs you this week.";
}

export default modulePage(membersManifest, async function HomePage() {
  const member = await requireMember();
  const database = getDatabase();
  if ((await resolveOnboardingStep(database, member)) !== ONBOARDING_STEPS.done) redirect(ROUTES.welcome);

  const isAdmin = isAdminMember(member);
  const enabledIds = await readEnabledIds(database);
  const isFeedOn = enabledIds.has(feedManifest.id);
  const [community, networkProgress, setupProgress, profile, avatarUrl, feedPage, today] = await Promise.all([
    readBrandingForPage(),
    enabledIds.has(networkManifest.id) ? readNetworkProgress(database, member) : null,
    isAdmin ? readSetupProgress(database) : null,
    readMemberProfile(database, member.id),
    readAvatarUrl(database, member.id),
    isFeedOn ? readFeedPage(database, member, null) : null,
    readTodayItems(database, member.id, enabledIds),
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

  const greeting = <PageHeader title={`Good to see you, ${readFirstName(member.name)}.`} description={readWeekSentence(today)} />;

  if (!feedPage) {
    return (
      <>
        {greeting}
        <div className="max-w-[640px]">
          <TodayList today={today} nextSteps={nextSteps} />
        </div>
      </>
    );
  }

  const queryClient = new QueryClient();
  queryClient.setQueryData(feedQuery().queryKey, { pages: [feedPage], pageParams: [null] });

  // With the feed on, the week comes first on a phone and sits beside the feed on a wide screen.
  return (
    <>
      {greeting}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_296px] lg:gap-7">
        <aside aria-label="For you" className="lg:sticky lg:top-9 lg:order-2">
          <TodayList today={today} nextSteps={nextSteps} />
        </aside>
        <div className="grid gap-5 lg:order-1">
          <HydrationBoundary state={dehydrate(queryClient)}>
            <Feed viewer={{ id: member.id, name: member.name, avatarUrl, isAdmin }} />
          </HydrationBoundary>
        </div>
      </div>
    </>
  );
});
