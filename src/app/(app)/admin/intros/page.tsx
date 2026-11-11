import { redirect } from "next/navigation";

import { ROUTES } from "@/platform/http/routes";
import { requireAdmin } from "@/platform/auth/session";
import { modulePage } from "@/platform/modules/module-page";

import { adminManifest } from "@/modules/admin/manifest";

// The console's Intro log (Founderhall's menu). Until its page is built, the intro counts live on the partner report.
export default modulePage(adminManifest, async function AdminIntroLogPage() {
  await requireAdmin();
  redirect(ROUTES.adminReport);
});
