import { redirect } from "next/navigation";

import { ROUTES } from "@/platform/http/routes";
import { requireAdmin } from "@/platform/auth/session";
import { modulePage } from "@/platform/modules/module-page";

import { adminManifest } from "@/modules/admin/manifest";

// The Health page became the partner report. Old links and bookmarks land there.
export default modulePage(adminManifest, async function AdminHealthPage() {
  await requireAdmin();
  redirect(ROUTES.adminReport);
});
