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
import { introsManifest } from "@/modules/intros/manifest";
import { messagesManifest } from "@/modules/messages/manifest";
import { EmailPreferencesCard } from "@/shell/email-preferences-card";
import { ReportCreditCard } from "@/modules/members/components/report-credit-card";
import { readReportCredit } from "@/modules/members/service-report-credit";
import { readEnabledIds } from "@/shell/enabled-modules";

// A topic with no module is always offered: the weekly email works whatever is on.
const TOPIC_MODULES = [
  { topic: EMAIL_TOPICS.weekly, moduleId: null },
  { topic: EMAIL_TOPICS.intros, moduleId: introsManifest.id },
  { topic: EMAIL_TOPICS.messages, moduleId: messagesManifest.id },
];

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
  const memberHasPassword = await hasPassword(database, member.id);
  const emailSettings = await readEmailSettings(database, member.id);
  const [isIntrosOn, isReportCreditOn] = await Promise.all([isModuleEnabled(database, introsManifest), readReportCredit(database, member.id)]);

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
      <PasswordCard hasPassword={memberHasPassword} isLinkOn={readResendConfig(process.env) !== null} />
      <EmailPreferencesCard settings={emailSettings} />
      {isIntrosOn ? <ReportCreditCard isOn={isReportCreditOn} /> : null}
      {showsLeaveCard ? <LeaveGroupCard /> : null}
    </div>
  );
});
