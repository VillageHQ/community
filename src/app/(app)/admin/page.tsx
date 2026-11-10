import type { Metadata } from "next";

import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { requireAdmin } from "@/platform/auth/session";
import { modulePage } from "@/platform/modules/module-page";

import { adminManifest } from "@/modules/admin/manifest";
import { readAdminHome } from "@/shell/admin-home";
import { AdminHomeView } from "@/shell/admin-home-view";

export const metadata: Metadata = { title: PAGE_TITLES.admin };

// The admin's first page: this quarter's intros, then what needs the admin, then every admin section.
export default modulePage(adminManifest, async function AdminHomePage() {
  await requireAdmin();
  const { quarter, items, facts } = await readAdminHome(getDatabase(), process.env);
  return <AdminHomeView quarter={quarter} items={items} facts={facts} />;
});
