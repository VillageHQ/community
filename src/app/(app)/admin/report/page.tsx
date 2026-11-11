import type { Metadata } from "next";

import { getDatabase } from "@/platform/database/client";
import { readBranding } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { requireAdmin } from "@/platform/auth/session";
import { modulePage } from "@/platform/modules/module-page";

import { adminManifest } from "@/modules/admin/manifest";
import { parseConsolePeriod } from "@/modules/admin/console-periods";
import { readReportStats } from "@/modules/admin/reads-report-stats";
import { ReportActions } from "@/modules/admin/components/report-actions";
import { ReportDocument } from "@/modules/admin/components/report-document";

export const metadata: Metadata = { title: PAGE_TITLES.adminReport };

// Founderhall's partner report: the toolbar, then the printable document for one period (?period=quarter|last|all).
export default modulePage(adminManifest, async function AdminReportPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const admin = await requireAdmin();
  const period = parseConsolePeriod((await searchParams).period);
  const database = getDatabase();
  const [report, branding] = await Promise.all([readReportStats(database, period), readBranding(database)]);
  return (
    <>
      <ReportActions period={period} />
      <ReportDocument report={report} preparedBy={admin.name || admin.email} logo={branding.logo} />
    </>
  );
});
