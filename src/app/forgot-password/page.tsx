import type { Metadata } from "next";

import { PublicPage } from "@/components/public-page";
import { Button } from "@/components/ui/button";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readResendConfig } from "@/platform/email/resend";
import { ROUTES } from "@/platform/http/routes";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { modulePage } from "@/platform/modules/module-page";

import { ForgotPasswordForm } from "./forgot-password-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.forgotPassword };

// Community-only (Founderhall has no passwords), as a Founderhall public card.
function WithoutEmail() {
  return (
    <>
      <p className="fh-lede">This community doesn&apos;t send email, so we can&apos;t send you a reset link.</p>
      <h2 className="fh-label mt-5">If you&apos;re a member</h2>
      <p className="fh-small fh-muted">
        Ask your admin to remove your account and invite you again. That creates a new account. Your old private messages stay on the old account, and you won&apos;t get them back.
        Nobody can set your password for you, not even an admin, because that would let them read your messages. Your admin can also turn email on, then you can reset it yourself
        here.
      </p>
      <h2 className="fh-label mt-5">If you&apos;re an admin</h2>
      <p className="fh-small fh-muted">You can choose a new password with the setup token from your deployment.</p>
      <div className="fh-btn-row mt-3">
        <Button asChild variant="secondary">
          <a href={ROUTES.recoverAdmin}>I lost my admin password</a>
        </Button>
      </div>
    </>
  );
}

export default modulePage(PLATFORM_MANIFEST, async function ForgotPasswordPage() {
  const community = await readBrandingForPage();
  const isEmailConfigured = readResendConfig(process.env) !== null;

  return (
    <PublicPage community={community}>
      <h1 className="fh-h2">Forgot your password?</h1>
      {isEmailConfigured ? (
        <>
          <p className="fh-lede">We email you a link to choose a new one.</p>
          <ForgotPasswordForm />
        </>
      ) : (
        <WithoutEmail />
      )}
      <p className="fh-small mt-4">
        <a href={ROUTES.signIn}>Back to sign in</a>
      </p>
    </PublicPage>
  );
});
