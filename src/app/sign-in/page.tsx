import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { getDatabase } from "@/database/client";
import { readBrandingForPage } from "@/lib/branding/branding";
import { isFirstAdminClaimed } from "@/lib/first-admin";
import { parseReturnPath, RETURN_PATH_PARAM } from "@/lib/return-path";
import { ADMIN_CREATED_PARAM, ROUTES } from "@/lib/routes";

import { SignInForm } from "./sign-in-form";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.signIn };

type SignInPageProps = { searchParams: Promise<{ [RETURN_PATH_PARAM]?: string; [ADMIN_CREATED_PARAM]?: string }> };

export default async function SignInPage({ searchParams }: SignInPageProps) {
  if (!(await isFirstAdminClaimed(getDatabase()))) redirect(ROUTES.setup);

  const community = await readBrandingForPage();
  const params = await searchParams;
  const returnPath = parseReturnPath(params[RETURN_PATH_PARAM]);
  const isAdminJustCreated = params[ADMIN_CREATED_PARAM] !== undefined;

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
        {returnPath ? (
          <p className="type-small mt-3 text-foreground-soft">
            Sign in to finish confirming your email. If you never accepted this invite, tell your admin.
          </p>
        ) : null}
        <div className="mt-7 rounded-panel bg-card p-5 shadow-panel sm:p-7">
          <SignInForm returnPath={returnPath} />
        </div>
      </div>
    </SplitLayout>
  );
}
