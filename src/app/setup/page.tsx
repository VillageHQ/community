import Link from "next/link";

import { PageCard } from "@/components/page-card";
import { getDatabase } from "@/database/client";
import { isFirstAdminClaimed } from "@/lib/first-admin";
import { ROUTES } from "@/lib/routes";
import { MINIMUM_SETUP_TOKEN_LENGTH, readSetupToken } from "@/lib/setup-token";

import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isFirstAdminClaimed(getDatabase())) {
    return (
      <PageCard title="Setup is complete" description="This community already has an admin.">
        <Link className="text-sm underline" href={ROUTES.signIn}>
          Sign in
        </Link>
      </PageCard>
    );
  }

  if (!readSetupToken(process.env)) {
    return (
      <PageCard
        title="Add a setup token to continue"
        description="A setup token is a long password that proves you own this deployment. Yours is missing or too weak, so nothing can be created yet."
      >
        <ol className="list-decimal space-y-1 pl-4 text-sm">
          <li>
            Create a random value of at least {MINIMUM_SETUP_TOKEN_LENGTH} characters. A password
            manager&apos;s generator works well. Don&apos;t use a word or a repeated pattern.
          </li>
          <li>Open your hosting dashboard and find this app&apos;s environment variables.</li>
          <li>Save the value in a variable named SETUP_TOKEN.</li>
          <li>Redeploy the app, then reload this page.</li>
        </ol>
      </PageCard>
    );
  }

  return (
    <PageCard title="Create the first admin" description="Setup closes permanently after this.">
      <SetupForm />
    </PageCard>
  );
}
