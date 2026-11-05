import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { SplitLayout, VillageNote } from "@/components/split-layout";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/platform/database/client";
import { readBrandingForPage } from "@/platform/branding/branding";
import { isFirstAdminClaimed } from "@/platform/auth/first-admin";
import { ROUTES } from "@/platform/http/routes";
import { MINIMUM_SETUP_TOKEN_LENGTH, readSetupToken } from "@/platform/secrets/setup-token";

import { SetupForm } from "./setup-form";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";

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
      <h1 className="type-h1 lg:type-display">Add a setup token to continue</h1>
      <p className="type-lead mt-3 text-foreground-soft">
        A setup token is a long password that proves you own this deployment. Yours is missing or too weak, so
        nothing can be created yet.
      </p>
      <ol className="mt-7 grid gap-3">
        {SETUP_TOKEN_STEPS.map((step, position) => (
          <li key={step} className="flex items-start gap-3.5 rounded-field bg-card p-4 shadow-panel">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground" aria-hidden="true">
              {position + 1}
            </span>
            <span className="min-w-0 pt-1">{step}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

export const metadata: Metadata = { title: PAGE_TITLES.setup };

export default async function SetupPage() {
  const community = await readBrandingForPage();

  if (await isFirstAdminClaimed(getDatabase())) {
    return (
      <SplitLayout community={community} note={<VillageNote />}>
        <div className="flex min-h-[60dvh] items-center justify-center">
          <EmptyState
            headingLevel="h1"
            icon={KeyRound}
            title="Setup is complete"
            description="This community already has an admin."
          >
            <Button asChild size="lg">
              <Link href={ROUTES.signIn}>Sign in</Link>
            </Button>
          </EmptyState>
        </div>
      </SplitLayout>
    );
  }

  if (!readSetupToken(process.env)) {
    return (
      <SplitLayout community={community} note={<VillageNote />}>
        <MissingTokenCopy />
      </SplitLayout>
    );
  }

  return (
    <SplitLayout community={community} note={<VillageNote />}>
      <h1 className="type-h1 lg:type-display">Let&apos;s set up your community.</h1>
      <p className="type-lead mt-3 text-foreground-soft">
        First, create the admin account. Setup closes permanently after this.
      </p>
      <div className="mt-7 rounded-panel bg-card p-5 shadow-panel sm:p-7">
        <SetupForm />
      </div>
    </SplitLayout>
  );
}
