import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { requireAdmin } from "@/platform/auth/session";
import { modulePage } from "@/platform/modules/module-page";

import { adminManifest } from "@/modules/admin/manifest";
import { parseConsolePeriod } from "@/modules/admin/console-periods";
import { readPartnerReportSettings } from "@/modules/admin/reads-partner-report";
import { readReportStats } from "@/modules/admin/reads-report-stats";
import { renderReportEmailText } from "@/modules/admin/report-stats";
import { PartnerSendForm } from "@/modules/admin/components/partner-send-card";

export const metadata: Metadata = { title: "Send to partners" };

// Founderhall's Send to partners: the report as a plain email, the numbers and never the notes.
export default modulePage(adminManifest, async function AdminReportSendPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const period = parseConsolePeriod((await searchParams).period);
  const database = getDatabase();
  const [report, settings] = await Promise.all([readReportStats(database, period), readPartnerReportSettings(database)]);
  return (
    <>
      <PageHeader
        back={{ href: `${ROUTES.adminReport}?period=${period}`, label: "Partner report" }}
        title="Send to partners"
        description={`The report as a plain email from ${report.communityName}: the numbers, never the notes.`}
      />
      <PartnerSendForm
        period={period}
        savedRecipients={settings.recipients}
        fromName={report.communityName}
        subject={report.title}
        text={renderReportEmailText(report, null)}
      />
    </>
  );
});
