import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readMemberProfile } from "@/modules/members/service-profile";
import { ROUTES } from "@/platform/http/routes";
import { requireMember } from "@/platform/auth/session";
import { hasPassword } from "@/platform/auth/password-setup";

import { CardForm } from "@/modules/members/components/card-form";
import { PasswordCard } from "@/modules/members/components/password-card";
import { membersManifest } from "@/modules/members/manifest";
import { LeaveGroupCard } from "@/modules/network/components/leave-group-card";
import { networkManifest } from "@/modules/network/manifest";
import { readIsInVillageGroup } from "@/modules/network/reads-progress";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { modulePage } from "@/platform/modules/module-page";
import { EMAIL_TOPICS } from "@/platform/email/kinds";
import { readResendConfig } from "@/platform/email/resend";
import { readOptedOutTopics } from "@/platform/email/unsubscribe";
import { asksManifest } from "@/modules/asks/manifest";
import { introsManifest } from "@/modules/intros/manifest";
import { messagesManifest } from "@/modules/messages/manifest";
import { EmailPreferencesCard } from "@/shell/email-preferences-card";
import { ReportCreditCard } from "@/modules/members/components/report-credit-card";
import { readReportCredit } from "@/modules/members/service-report-credit";
import { readEnabledIds } from "@/shell/enabled-modules";
import { isFilledLogoShown } from "@/modules/members/rules-fill-in";
import { FILL_IN_FIELDS, type FilledLine } from "@/modules/members/contract-fill-in";
import { readFilledLines, readLookupState } from "@/modules/members/service-fill-in";
import { FillInCard, type OwnWords } from "@/modules/members/components/fill-in-card";
import { LookupQuestionCard } from "@/modules/members/components/lookup-question-card";
import { FillInNowButton } from "@/modules/network/components/fill-in-now-button";
import { VillageDisclosure } from "@/modules/network/components/village-disclosure";
import { readBrandingForPage } from "@/platform/branding/branding";
import { isAdminMember } from "@/platform/auth/roles";
import { CardJobsSection } from "@/modules/job-board/components/card-jobs-section";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { readMemberSources } from "@/modules/job-board/reads";

// A topic with no module is always offered: the weekly email works whatever is on.
const TOPIC_MODULES = [
  { topic: EMAIL_TOPICS.weekly, moduleId: null },
  { topic: EMAIL_TOPICS.intros, moduleId: introsManifest.id },
  { topic: EMAIL_TOPICS.messages, moduleId: messagesManifest.id },
  { topic: EMAIL_TOPICS.network, moduleId: networkManifest.id },
  { topic: EMAIL_TOPICS.asks, moduleId: asksManifest.id },
];

type Profile = NonNullable<Awaited<ReturnType<typeof readMemberProfile>>>;

function readOwnWords(profile: Profile, lines: readonly FilledLine[]): OwnWords {
  const filledCompany = lines.find(({ field, isHidden }) => field === FILL_IN_FIELDS.company && !isHidden)?.value;
  return {
    [FILL_IN_FIELDS.title]: Boolean(profile.title),
    [FILL_IN_FIELDS.company]: Boolean(profile.company),
    [FILL_IN_FIELDS.location]: Boolean(profile.location),
    [FILL_IN_FIELDS.face]: profile.avatarUrl !== null,
    [FILL_IN_FIELDS.companyLogo]: !isFilledLogoShown(profile.company, filledCompany),
  };
}

// The member keeps their controls even with Network off, as long as filled-in lines can show.
async function readFillIn(database: ReturnType<typeof getDatabase>, memberId: string) {
  const state = await readLookupState(database, memberId);
  if (!state.basis) return null;
  return { state, lines: await readFilledLines(database, memberId) };
}

async function readEmailSettings(database: ReturnType<typeof getDatabase>, memberId: string) {
  if (!readResendConfig(process.env)) return [];
  const [enabledIds, optedOut] = await Promise.all([readEnabledIds(database), readOptedOutTopics(database, memberId)]);
  return TOPIC_MODULES.filter(({ moduleId }) => moduleId === null || enabledIds.has(moduleId)).map(({ topic }) => ({ topic, isOn: !optedOut.has(topic) }));
}

export const metadata: Metadata = { title: PAGE_TITLES.editCard };

export default modulePage(membersManifest, async function EditCardPage() {
  const member = await requireMember();
  const database = getDatabase();
  const profile = await readMemberProfile(database, member.id);
  if (!profile) notFound();

  const isNetworkOn = await isModuleEnabled(database, networkManifest);
  const showsLeaveCard = !isNetworkOn && (await readIsInVillageGroup(database, member.id));
  const [emailSettings, fillIn, memberHasPassword] = await Promise.all([
    readEmailSettings(database, member.id),
    readFillIn(database, member.id),
    hasPassword(database, member.id),
  ]);
  const [isIntrosOn, isReportCreditOn, isJobBoardOn] = await Promise.all([
    isModuleEnabled(database, introsManifest),
    readReportCredit(database, member.id),
    isModuleEnabled(database, jobBoardManifest),
  ]);
  const jobSources = isJobBoardOn ? await readMemberSources(database, member.id) : null;

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader
        title="Your card"
        description="This is how members find you. Your email stays private."
        action={
          <Button asChild variant="quiet" size="sm">
            <Link href={`${ROUTES.members}/${member.id}`}>
              <ArrowLeft aria-hidden="true" />
              View my profile
            </Link>
          </Button>
        }
      />
      <div className="rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
        <CardForm profile={profile} />
      </div>
      {jobSources ? <CardJobsSection sources={jobSources} company={profile.company ?? ""} isCompanyFixed={!isAdminMember(member)} /> : null}
      {isNetworkOn && fillIn?.state.needsAnswer ? (
        <div className="mt-5">
          <LookupQuestionCard communityName={(await readBrandingForPage()).name} />
        </div>
      ) : null}
      {fillIn && fillIn.state.basis && !(isNetworkOn && fillIn.state.needsAnswer) ? (
        <FillInCard
          state={{
            basis: fillIn.state.basis,
            termsDate: fillIn.state.termsDate,
            isAllowed: fillIn.state.isAllowed,
            status: fillIn.state.status,
            lookedUpAt: fillIn.state.lookedUpAt?.toISOString() ?? null,
          }}
          lines={fillIn.lines}
          ownWords={readOwnWords(profile, fillIn.lines)}
          fillNowButton={isNetworkOn ? <FillInNowButton /> : null}
        />
      ) : null}
      <PasswordCard hasPassword={memberHasPassword} isLinkOn={readResendConfig(process.env) !== null} />
      <EmailPreferencesCard settings={emailSettings} />
      {isNetworkOn ? <VillageDisclosure isFillInOn={fillIn?.state.isAllowed === true} /> : null}
      {isIntrosOn ? <ReportCreditCard isOn={isReportCreditOn} /> : null}
      {showsLeaveCard ? <LeaveGroupCard /> : null}
      <section aria-labelledby="your-data-link-title" className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
        <div className="grid gap-1">
          <h2 id="your-data-link-title" className="type-h3">
            Your data
          </h2>
          <p className="type-small text-foreground-soft">See what is kept about you, export it, choose who can reach you, or delete your account.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={ROUTES.yourData}>Open Your data</Link>
        </Button>
      </section>
    </div>
  );
});
