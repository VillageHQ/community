import type { Metadata } from "next";

import { adminManifest } from "@/modules/admin/manifest";
import { ImportMembersForm } from "@/modules/members/components/import-members-form";
import { readFillInSettings } from "@/modules/members/service-fill-in";
import { requireAdmin } from "@/platform/auth/session";
import { readBranding } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { AdminSection } from "@/shell/admin-section";

export const metadata: Metadata = { title: PAGE_TITLES.adminImport };

// Set up › Import members (CSV): Founderhall's import page. The paste-a-list invite stays on Invites.
export default modulePage(adminManifest, async function AdminImportPage() {
  await requireAdmin();
  const database = getDatabase();
  const [branding, fillIn] = await Promise.all([readBranding(database), readFillInSettings(database)]);

  return (
    <AdminSection
      title="Import members (CSV)"
      back={{ href: ROUTES.adminSetup, label: "Set up" }}
      description={`Bring a whole alumni list into ${branding.name} in one upload. Columns: name, email, company, cohort. People already in the portal are skipped.`}
    >
      <ImportMembersForm communityBasis={fillIn.basis} communityTermsDate={fillIn.termsDate} today={new Date().toISOString().slice(0, 10)} />
    </AdminSection>
  );
});
