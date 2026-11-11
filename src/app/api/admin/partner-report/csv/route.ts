import { partnerReportCsvBodySchema } from "@/modules/admin/contract-partner-report";
import { readCommunitySection } from "@/modules/admin/partner-report-rows";
import { readPartnerReport } from "@/modules/admin/reads-partner-report";
import { readReportStats } from "@/modules/admin/reads-report-stats";
import { renderReportCsv } from "@/modules/admin/report-stats";
import { adminRoutes } from "@/modules/admin/routes";

function readFileName(communityName: string, period: string, date: string) {
  const slug = communityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "community";
  return `${slug}-partner-report-${period}-${date}.csv`;
}

// The partner report's CSV for one period, from the same read as the page and the email, then the community today.
export const POST = adminRoutes.member(
  "admin-partner-report-csv",
  partnerReportCsvBodySchema,
  async ({ database }, { period }) => {
    const [report, full] = await Promise.all([readReportStats(database, period), readPartnerReport(database)]);
    const community = readCommunitySection(full).rows.map(({ label, values }) => ({ label, value: values[0] ?? null }));
    return new Response(renderReportCsv(report, community), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${readFileName(report.communityName, period, new Date().toISOString().slice(0, 10))}"`,
        "Cache-Control": "no-store",
      },
    });
  },
  { adminOnly: true },
);
