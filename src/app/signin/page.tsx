import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Note } from "@/components/ui/note";
import { getDatabase } from "@/platform/database/client";
import { readBrandingForPage } from "@/platform/branding/branding";
import { readDataHome } from "@/platform/settings/data-home";
import { isFirstAdminClaimed } from "@/platform/auth/first-admin";
import { parseReturnPath, RETURN_PATH_PARAM } from "@/platform/http/return-path";
import { ACCOUNT_DELETED_PARAM, ADMIN_CREATED_PARAM, ROUTES } from "@/platform/http/routes";
import { DEMO_UNAVAILABLE_PARAM, isDemoMode } from "@/platform/demo/mode";
import { readResendConfig } from "@/platform/email/resend";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { modulePage } from "@/platform/modules/module-page";

import { DemoSignIn } from "./demo-sign-in";
import { SignInScreen } from "./sign-in-screen";

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

function readNotice(params: Awaited<SignInPageProps["searchParams"]>, communityName: string, returnPath: string | null) {
  if (params[ADMIN_CREATED_PARAM] !== undefined) {
    return "Your admin account is ready. Sign in with the email and password you just chose. A checklist takes you through the rest.";
  }
  if (params[ACCOUNT_DELETED_PARAM] !== undefined) return `Your account and everything it held are deleted. Thank you for being part of ${communityName}.`;
  if (returnPath) return "Sign in to finish confirming your email. If you never accepted this invite, tell your admin.";
  return null;
}

// Founderhall's /signin. Its demo shows the email form too: there, as anywhere, the page then says "Check your email".
export default modulePage(PLATFORM_MANIFEST, async function SignInPage({ searchParams }: SignInPageProps) {
  if (!(await isFirstAdminClaimed(getDatabase()))) redirect(ROUTES.setup);

  const [community, dataHome] = await Promise.all([readBrandingForPage(), readDataHome(getDatabase())]);
  const params = await searchParams;
  const returnPath = parseReturnPath(params[RETURN_PATH_PARAM]);
  const isAdminJustCreated = params[ADMIN_CREATED_PARAM] !== undefined;
  const isDemo = isDemoMode(process.env);
  const isEmailOn = readResendConfig(process.env) !== null;
  const notice = readNotice(params, community.name, returnPath);

  return (
    <SignInScreen
      community={{ name: community.name, logo: community.logo }}
      hosting={dataHome.location ? `${community.name}, ${dataHome.location}` : undefined}
      isLinkOn={(isEmailOn || isDemo) && !isAdminJustCreated}
      returnPath={returnPath}
      notice={notice ? <Note className="mt-4" role="status">{notice}</Note> : null}
      demo={isDemo ? <DemoSignIn failure={params[DEMO_UNAVAILABLE_PARAM]} /> : null}
    />
  );
});
