import type { Metadata } from "next";

import { BackLink } from "@/components/page-header";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { requireMember } from "@/platform/auth/session";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { membersManifest } from "@/modules/members/manifest";
import { EmailSettingsForm } from "@/shell/email-preferences-card";
import { readEmailSettingRows } from "@/shell/email-settings";

export const metadata: Metadata = { title: PAGE_TITLES.emailSettings };

// Founderhall's Email settings (member-me-email).
export default modulePage(membersManifest, async function EmailSettingsPage() {
  const member = await requireMember();
  const database = getDatabase();
  const [community, rows] = await Promise.all([readBrandingForPage(), readEmailSettingRows(database, member.id)]);
  return (
    <>
      <BackLink href={ROUTES.editCard}>My profile</BackLink>
      <header data-slot="page-header" className="fh-pagehead">
        <h1 className="fh-h1">Email</h1>
        <p className="fh-lede">What {community.name} emails you. Sign-in links and invites always come.</p>
      </header>
      <div className="max-w-[720px]">
        {rows ? <EmailSettingsForm rows={rows} /> : <p className="fh-small fh-muted">{community.name} hasn’t set up email yet, so nothing is sent.</p>}
      </div>
    </>
  );
});
