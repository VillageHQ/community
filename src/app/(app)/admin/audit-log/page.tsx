import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getDatabase } from "@/platform/database/client";
import { readAuditLog } from "@/lib/admin/audit";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { requireAdmin } from "@/platform/auth/session";

import { AdminSection } from "@/app/(app)/admin/admin-section";
import { AuditLog } from "./audit-log";
import { auditPageQuery } from "./audit-queries";

const FIRST_PAGE = 1;

export const metadata: Metadata = { title: PAGE_TITLES.adminAuditLog };

export default async function AdminAuditLogPage() {
  await requireAdmin();
  const auditPage = await readAuditLog(getDatabase(), FIRST_PAGE);
  const queryClient = new QueryClient();
  queryClient.setQueryData(auditPageQuery(FIRST_PAGE).queryKey, auditPage);

  return (
    <AdminSection title="Audit log" description="Who did what, and when. Nothing here can be edited from this site.">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AuditLog />
      </HydrationBoundary>
    </AdminSection>
  );
}
