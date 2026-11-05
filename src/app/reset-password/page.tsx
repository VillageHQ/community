import type { Metadata } from "next";
import Link from "next/link";

import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { Button } from "@/components/ui/button";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { ROUTES } from "@/platform/http/routes";

import { ResetPasswordForm } from "./reset-password-form";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { modulePage } from "@/platform/modules/module-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.resetPassword };

export default modulePage(PLATFORM_MANIFEST, async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const community = await readBrandingForPage();
  const { token } = await searchParams;

  return (
    <SplitLayout community={community} note={<CommunityNote community={community}>Almost back in.</CommunityNote>}>
      <div className="flex min-h-[60dvh] flex-col justify-center lg:min-h-[calc(100dvh-140px)]">
        <h1 className="type-h1">Choose a new password</h1>
        <div className="mt-7 rounded-panel bg-card p-5 shadow-panel sm:p-7">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="grid gap-4">
              <p className="text-foreground-soft">This link isn&apos;t complete. Ask for a new one.</p>
              <Button asChild size="lg">
                <Link href={ROUTES.forgotPassword}>Ask for a new link</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </SplitLayout>
  );
});
