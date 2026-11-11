import { redirect } from "next/navigation";

import { ROUTES } from "@/platform/http/routes";
import { requireAdmin } from "@/platform/auth/session";
import { modulePage } from "@/platform/modules/module-page";

import { adminManifest } from "@/modules/admin/manifest";

// The console's Invites (Founderhall's menu). Until its page is built, invites live on Members.
export default modulePage(adminManifest, async function AdminInvitesPage() {
  await requireAdmin();
  redirect(ROUTES.adminMembers);
});
