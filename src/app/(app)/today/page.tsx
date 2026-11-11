import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { asksManifest } from "@/modules/asks/manifest";
import { readAskFlash } from "@/modules/asks/contract";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { readBoardJobs } from "@/modules/job-board/reads";
import { describeEmailConfirmation } from "@/modules/members/contract-email-confirmation-copy";
import { ONBOARDING_STEPS } from "@/modules/members/contract-profile";
import { LookupQuestionCard } from "@/modules/members/components/lookup-question-card";
import { membersManifest } from "@/modules/members/manifest";
import { readLookupState } from "@/modules/members/service-fill-in";
import { isCardFilledIn, readMemberProfile } from "@/modules/members/service-profile";
import { networkManifest } from "@/modules/network/manifest";
import { readNetworkProgress } from "@/modules/network/reads-progress";
import { perksManifest } from "@/modules/perks/manifest";
import { readPerksUrl } from "@/modules/perks/service";
import { requireMember } from "@/platform/auth/session";
import { isDemoMode } from "@/platform/demo/mode";
import { readBrandingForPage } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { readResendConfig } from "@/platform/email/resend";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { WEEKDAYS } from "@/platform/weekly-email/schedule";
import { readWeeklySchedule } from "@/platform/weekly-email/schedule-store";
import { readAskAllowance } from "@/shell/ask-helpers";
import { readEnabledIds } from "@/shell/enabled-modules";
import { selectNextSteps } from "@/shell/next-steps";
import { resolveOnboardingStep } from "@/shell/onboarding";
import { readTodayItems } from "@/shell/today";
import { TodayPage } from "@/shell/today-list";

export const metadata: Metadata = { title: "Today" };

type TodayRouteProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Founderhall's Today: the member home. Admins see it as the founder view; their setup lives on the console's Home.
export default modulePage(membersManifest, async function TodayRoute({ searchParams }: TodayRouteProps) {
  const member = await requireMember();
  const database = getDatabase();
  if ((await resolveOnboardingStep(database, member)) !== ONBOARDING_STEPS.done) redirect(ROUTES.welcome);

  const now = new Date();
  const enabledIds = await readEnabledIds(database);
  const isNetworkOn = enabledIds.has(networkManifest.id);
  const [community, networkProgress, profile, today, lookupState, perksUrl, jobs, allowance, schedule, query] = await Promise.all([
    readBrandingForPage(),
    isNetworkOn ? readNetworkProgress(database, member) : null,
    readMemberProfile(database, member.id),
    readTodayItems(database, member.id, enabledIds, now),
    isNetworkOn ? readLookupState(database, member.id) : null,
    enabledIds.has(perksManifest.id) ? readPerksUrl(database) : null,
    enabledIds.has(jobBoardManifest.id) ? readBoardJobs(database, null) : null,
    enabledIds.has(asksManifest.id) ? readAskAllowance(database, member.id, now) : null,
    readWeeklySchedule(database),
    searchParams,
  ]);

  const nextSteps = selectNextSteps({
    setupProgress: null,
    networkProgress,
    communityName: community.isSaved ? community.name : "your community",
    isCardFilled: profile !== null && isCardFilledIn(profile),
    confirmationCopy: describeEmailConfirmation(community.isSaved ? community.name : "your admin", readResendConfig(process.env) !== null),
  });
  const flashKey = Array.isArray(query.m) ? query.m[0] : query.m;

  return (
    <TodayPage
      today={today}
      memberName={member.name}
      communityName={community.name}
      digestDay={WEEKDAYS[schedule.weekday] ?? "Thursday"}
      dateLabel={now.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
      allowance={allowance}
      perksCommunityName={perksUrl || (enabledIds.has(perksManifest.id) && isDemoMode(process.env)) ? community.name : null}
      openJobCount={jobs ? jobs.length : null}
      nextSteps={nextSteps}
      lookupQuestion={lookupState?.needsAnswer ? <LookupQuestionCard communityName={community.name} /> : null}
      flash={readAskFlash(flashKey)}
      now={now}
    />
  );
});
