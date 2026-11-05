import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getDatabase } from "@/database/client";
import { REPORT_FILTERS } from "@/lib/admin/admin-api";
import { readReports } from "@/lib/admin/reports";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";
import { requireAdmin } from "@/lib/session";

import { AdminSection } from "../admin-section";
import { reportPageQuery } from "./report-queries";
import { ReportQueue } from "./report-queue";

const FIRST_PAGE = 1;

export const metadata: Metadata = { title: PAGE_TITLES.adminReports };

export default async function AdminReportsPage() {
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
}
