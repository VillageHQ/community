import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getDatabase } from "@/platform/database/client";
import { REPORT_FILTERS } from "@/modules/admin/contract";
import { readReports } from "@/modules/admin/service-reports";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { requireAdmin } from "@/platform/auth/session";

import { AdminSection } from "@/shell/admin-section";
import { reportPageQuery } from "@/modules/admin/queries-reports";
import { ReportQueue } from "@/modules/admin/components/report-queue";
import { adminManifest } from "@/modules/admin/manifest";
import { modulePage } from "@/platform/modules/module-page";

const FIRST_PAGE = 1;

export const metadata: Metadata = { title: PAGE_TITLES.adminReports };

export default modulePage(adminManifest, async function AdminReportsPage() {
  const admin = await requireAdmin();
  const reports = await readReports(getDatabase(), REPORT_FILTERS.open, FIRST_PAGE);
  const queryClient = new QueryClient();
  queryClient.setQueryData(reportPageQuery(REPORT_FILTERS.open, FIRST_PAGE).queryKey, reports);

  return (
    <AdminSection title="Reports" description="What members flagged. Only you and other admins see this, and nobody is told who reported.">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ReportQueue viewerId={admin.id} />
      </HydrationBoundary>
    </AdminSection>
  );
});
