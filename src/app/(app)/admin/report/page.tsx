import type { Metadata } from "next";

import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readResendConfig } from "@/platform/email/resend";
import { requireAdmin } from "@/platform/auth/session";
import { modulePage } from "@/platform/modules/module-page";

import { AdminSection } from "@/shell/admin-section";
import { adminManifest } from "@/modules/admin/manifest";
import { readCommunitySection, readPeriodSections } from "@/modules/admin/partner-report-rows";
import { readPartnerReport, readPartnerReportSettings } from "@/modules/admin/reads-partner-report";
import { PartnerSendCard } from "@/modules/admin/components/partner-send-card";
import { ReportActions } from "@/modules/admin/components/report-actions";
import { ReportTable } from "@/modules/admin/components/report-table";

export const metadata: Metadata = { title: PAGE_TITLES.adminReport };

const GENERATED_AT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default modulePage(adminManifest, async function AdminReportPage() {
  await requireAdmin();
  const database = getDatabase();
  const [report, settings] = await Promise.all([readPartnerReport(database), readPartnerReportSettings(database)]);
  const headings = report.periods.map(({ label, range }) => ({ label, range }));
  const community = readCommunitySection(report);

  return (
    <AdminSection
      title="Partner report"
      description={`${report.communityName}, as of ${GENERATED_AT.format(new Date(report.generatedAt))}. Counts only: who asked whom never appears here.`}
      action={<ReportActions />}
    >
      <div className="grid gap-5">
        {readPeriodSections(report).map((section) => (
          <ReportTable key={section.id} section={section} headings={headings} />
        ))}
        <ReportTable section={community} headings={[{ label: "Today", range: "" }]} />
        <PartnerSendCard savedRecipients={settings.recipients} isEmailConfigured={readResendConfig(process.env) !== null} />
      </div>
    </AdminSection>
  );
});
