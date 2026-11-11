import type { Metadata } from "next";
import { PublicMessage, PublicPage } from "@/components/public-page";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/platform/database/client";
import { readBrandingForPage } from "@/platform/branding/branding";
import { isFirstAdminClaimed } from "@/platform/auth/first-admin";
import { ROUTES } from "@/platform/http/routes";
import { MINIMUM_SETUP_TOKEN_LENGTH, readSetupToken } from "@/platform/secrets/setup-token";

import { SetupForm } from "./setup-form";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { modulePage } from "@/platform/modules/module-page";

export const dynamic = "force-dynamic";

const SETUP_TOKEN_STEPS = [
  `Create a random password of at least ${MINIMUM_SETUP_TOKEN_LENGTH} characters. A password manager's generator works well, like 1Password's free one at 1password.com/password-generator. Don't use a word or a repeated pattern.`,
  "Open the settings for this app on your host. On Vercel: Settings, then Environment Variables. On Railway: your service, then Variables. On DigitalOcean: your app, then Settings, then App-Level Environment Variables.",
  "Add a setting named SETUP_TOKEN, and paste the password as its value.",
  "Save it and restart the app. On Vercel: Deployments, then Redeploy. On Railway: Deploy. DigitalOcean restarts it by itself. Then reload this page.",
];

function MissingTokenCopy() {
  return (
    <>
      <h1 className="fh-h2">Add a setup token to continue</h1>
      <p className="fh-lede">
        A setup token is a long password that proves you own this deployment. Yours is missing or too weak, so
        nothing can be created yet.
      </p>
      <ol className="mt-4 list-decimal pl-5">
        {SETUP_TOKEN_STEPS.map((step) => (
          <li key={step} className="mt-2 text-[14px] leading-5">
            {step}
          </li>
        ))}
      </ol>
    </>
  );
}

export const metadata: Metadata = { title: PAGE_TITLES.setup };

export default modulePage(PLATFORM_MANIFEST, async function SetupPage() {
  const community = await readBrandingForPage();

  if (await isFirstAdminClaimed(getDatabase())) {
    return (
      <PublicMessage
        community={community}
        title="Setup is complete"
        action={
          <Button asChild>
            <a href={ROUTES.signIn}>Sign in</a>
          </Button>
        }
      >
        This community already has an admin.
      </PublicMessage>
    );
  }

  if (!readSetupToken(process.env)) {
    return (
      <PublicPage community={community}>
        <MissingTokenCopy />
      </PublicPage>
    );
  }

  return (
    <PublicPage community={community}>
      <h1 className="fh-h2">Set up {community.isSaved ? community.name : "your community"}</h1>
      <p className="fh-lede">First, create the admin account. Setup closes for good after this.</p>
      <SetupForm />
    </PublicPage>
  );
});
