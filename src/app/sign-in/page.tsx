import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { getDatabase } from "@/database/client";
import { readBrandingForPage } from "@/lib/branding/branding";
import { isFirstAdminClaimed } from "@/lib/first-admin";
import { ROUTES } from "@/lib/routes";

import { SignInForm } from "./sign-in-form";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.signIn };

export default async function SignInPage() {
  if (!(await isFirstAdminClaimed(getDatabase()))) redirect(ROUTES.setup);

  const community = await readBrandingForPage();

  return (
    <SplitLayout
      community={community}
      note={<CommunityNote community={community}>Good to see you. Everyone&apos;s right inside.</CommunityNote>}
    >
      <div className="flex min-h-[60dvh] flex-col justify-center lg:min-h-[calc(100dvh-140px)]">
        <h1 className="type-h1 lg:type-display">Welcome back.</h1>
        <p className="type-lead mt-3 text-foreground-soft">Sign in to {community.isSaved ? community.name : "your community"}.</p>
        <div className="mt-7 rounded-panel bg-card p-5 shadow-panel sm:p-7">
          <SignInForm />
        </div>
      </div>
    </SplitLayout>
  );
}
