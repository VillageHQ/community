import type { Metadata } from "next";

import { asksManifest } from "@/modules/asks/manifest";
import { requireAdmin } from "@/platform/auth/session";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";
import { readAdminAsks } from "@/shell/admin-asks";
import { AdminAsksView } from "@/shell/admin-asks-view";
import { AdminSection } from "@/shell/admin-section";

export const metadata: Metadata = { title: PAGE_TITLES.adminAsks };

export default modulePage(asksManifest, async function AdminAsksPage() {
  await requireAdmin();
  const adminAsks = await readAdminAsks(getDatabase());
  return (
    <AdminSection title="Asks" description="How asks are going this quarter, the ones waiting longest, and what members reported.">
      <AdminAsksView {...adminAsks} />
    </AdminSection>
  );
});
