import { permanentRedirect } from "next/navigation";

import { adminManifest } from "@/modules/admin/manifest";
import { requireAdmin } from "@/platform/auth/session";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";

// The weekly email moved to Asks & digest; its preview is the digest preview (Founderhall's /admin/digest).
export default modulePage(adminManifest, async function AdminWeeklyEmailPage() {
  await requireAdmin();
  permanentRedirect(ROUTES.adminDigest);
});
