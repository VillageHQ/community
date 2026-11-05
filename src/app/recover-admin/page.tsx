import type { Metadata } from "next";
import Link from "next/link";

import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { Button } from "@/components/ui/button";
import { readBrandingForPage } from "@/lib/branding/branding";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";
import { readResendConfig } from "@/lib/email/resend";
import { ROUTES } from "@/lib/routes";

import { RecoverAdminForm } from "./recover-admin-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.recoverAdmin };

export default async function RecoverAdminPage() {
  const community = await readBrandingForPage();
  const isEmailConfigured = readResendConfig(process.env) !== null;

  return (
    <SplitLayout community={community} note={<CommunityNote community={community}>Only whoever runs this deployment has the token.</CommunityNote>}>
      <div className="flex min-h-[60dvh] flex-col justify-center lg:min-h-[calc(100dvh-140px)]">
        <h1 className="type-h1">I lost my admin password</h1>
        <p className="type-lead mt-3 text-foreground-soft">
          {isEmailConfigured ? "Email is on, so you can reset it with a link." : "This works for admins only. It signs you out everywhere and goes in the audit log."}
        </p>
        <div className="mt-7 rounded-panel bg-card p-5 shadow-panel sm:p-7">
          {isEmailConfigured ? (
            <Button asChild size="lg" className="w-full">
              <Link href={ROUTES.forgotPassword}>Reset it by email</Link>
            </Button>
          ) : (
            <RecoverAdminForm />
          )}
        </div>
        <div className="mt-5">
          <Button asChild variant="quiet">
            <Link href={ROUTES.signIn}>Back to sign in</Link>
          </Button>
        </div>
      </div>
    </SplitLayout>
  );
}
