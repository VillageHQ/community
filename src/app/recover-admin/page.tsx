import type { Metadata } from "next";

import { ExternalTextLink } from "@/components/external-text-link";
import { PublicPage } from "@/components/public-page";
import { Button } from "@/components/ui/button";
import { SETUP_TOKEN_GUIDE_URL } from "@/modules/admin/copy";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readResendConfig } from "@/platform/email/resend";
import { ROUTES } from "@/platform/http/routes";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { modulePage } from "@/platform/modules/module-page";

import { RecoverAdminForm } from "./recover-admin-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.recoverAdmin };

// Community-only (an admin who lost their password), as a Founderhall public card.
export default modulePage(PLATFORM_MANIFEST, async function RecoverAdminPage() {
  const community = await readBrandingForPage();
  const isEmailConfigured = readResendConfig(process.env) !== null;

  return (
    <PublicPage community={community}>
      <h1 className="fh-h2">I lost my admin password</h1>
      <p className="fh-lede">
        {isEmailConfigured ? "Email is on, so you can reset it with a link." : "This works for admins only. It signs you out everywhere and goes in the audit log."}
      </p>
      {isEmailConfigured ? (
        <div className="fh-btn-row mt-4">
          <Button asChild width="block">
            <a href={ROUTES.forgotPassword}>Reset it by email</a>
          </Button>
        </div>
      ) : (
        <>
          <RecoverAdminForm />
          <p className="fh-small fh-muted mt-4">
            Lost the setup token too? <ExternalTextLink href={SETUP_TOKEN_GUIDE_URL}>Set a new one in your host&apos;s settings</ExternalTextLink>.
          </p>
        </>
      )}
      <p className="fh-small mt-4">
        <a href={ROUTES.signIn}>Back to sign in</a>
      </p>
    </PublicPage>
  );
});
