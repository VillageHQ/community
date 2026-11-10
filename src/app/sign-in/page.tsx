import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { getDatabase } from "@/platform/database/client";
import { readBrandingForPage } from "@/platform/branding/branding";
import { isFirstAdminClaimed } from "@/platform/auth/first-admin";
import { parseReturnPath, RETURN_PATH_PARAM } from "@/platform/http/return-path";
import { ACCOUNT_DELETED_PARAM, ADMIN_CREATED_PARAM, ROUTES } from "@/platform/http/routes";

import { DemoSignIn } from "./demo-sign-in";
import { SignInChoice } from "./sign-in-form";
import { DEMO_UNAVAILABLE_PARAM, isDemoMode } from "@/platform/demo/mode";
import { readResendConfig } from "@/platform/email/resend";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { modulePage } from "@/platform/modules/module-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.signIn };

type SignInPageProps = {
  searchParams: Promise<{
    [RETURN_PATH_PARAM]?: string;
    [ADMIN_CREATED_PARAM]?: string;
    [ACCOUNT_DELETED_PARAM]?: string;
    [DEMO_UNAVAILABLE_PARAM]?: string;
  }>;
};

export default modulePage(PLATFORM_MANIFEST, async function SignInPage({ searchParams }: SignInPageProps) {
  if (!(await isFirstAdminClaimed(getDatabase()))) redirect(ROUTES.setup);

  const community = await readBrandingForPage();
  const params = await searchParams;
  const returnPath = parseReturnPath(params[RETURN_PATH_PARAM]);
  const isAdminJustCreated = params[ADMIN_CREATED_PARAM] !== undefined;
  const isDemo = isDemoMode(process.env);

  return (
    <SplitLayout
      community={community}
      note={<CommunityNote community={community}>Good to see you. Everyone&apos;s right inside.</CommunityNote>}
    >
      <div className="flex min-h-[60dvh] flex-col justify-center lg:min-h-[calc(100dvh-140px)]">
        <h1 className="type-h1 lg:type-display">{isAdminJustCreated ? "Your admin account is ready." : "Welcome back."}</h1>
        <p className="type-lead mt-3 text-foreground-soft">
          {isAdminJustCreated
            ? "Sign in with the email and password you just chose. A checklist takes you through the rest."
            : `Sign in to ${community.isSaved ? community.name : "your community"}.`}
        </p>
        {params[ACCOUNT_DELETED_PARAM] !== undefined ? (
          <p role="status" className="type-small mt-4 rounded-field bg-muted p-3.5 text-foreground">
            Your account and everything it held are deleted. Thank you for being part of {community.isSaved ? community.name : "this community"}.
          </p>
        ) : null}
        {returnPath ? (
          <p className="type-small mt-3 text-foreground-soft">
            Sign in to finish confirming your email. If you never accepted this invite, tell your admin.
          </p>
        ) : null}
        {isDemo ? <DemoSignIn failure={params[DEMO_UNAVAILABLE_PARAM]} /> : null}
        <div className="mt-7 rounded-panel bg-card p-5 shadow-panel sm:p-7">
          {/* In the demo no email can arrive, so sign-in links are hidden. */}
          <SignInChoice returnPath={returnPath} isLinkOn={!isDemo && !isAdminJustCreated && readResendConfig(process.env) !== null} />
        </div>
      </div>
    </SplitLayout>
  );
});
