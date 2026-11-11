import type { Metadata } from "next";

import { PublicPage } from "@/components/public-page";
import { Button } from "@/components/ui/button";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { ROUTES } from "@/platform/http/routes";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { modulePage } from "@/platform/modules/module-page";

import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.resetPassword };

// Community-only (Founderhall has no passwords), as a Founderhall public card.
export default modulePage(PLATFORM_MANIFEST, async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const community = await readBrandingForPage();
  const { token } = await searchParams;

  return (
    <PublicPage community={community}>
      <h1 className="fh-h2">Choose a new password</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <>
          <p className="fh-lede">This link isn&apos;t complete. Ask for a new one.</p>
          <div className="fh-btn-row mt-4">
            <Button asChild>
              <a href={ROUTES.forgotPassword}>Ask for a new link</a>
            </Button>
          </div>
        </>
      )}
    </PublicPage>
  );
});
