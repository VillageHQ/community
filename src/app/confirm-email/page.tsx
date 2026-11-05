import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { getDatabase } from "@/platform/database/client";
import { readActiveSession } from "@/platform/auth/active-session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readConfirmationView } from "@/lib/invites/email-confirmation";
import { CONFIRMATION_VIEWS } from "@/lib/invites/email-confirmation-views";
import { toSignInPath } from "@/platform/http/return-path";
import { ROUTES } from "@/platform/http/routes";

import { ConfirmEmailPanel } from "./confirm-email-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.confirmEmail, robots: { index: false, follow: false } };

type ConfirmEmailPageProps = { searchParams: Promise<{ token?: string }> };

export default async function ConfirmEmailPage({ searchParams }: ConfirmEmailPageProps) {
  const { token = "" } = await searchParams;
  const session = await readActiveSession(await headers());
  const view = await readConfirmationView(getDatabase(), token, session?.user ?? null);
  const path = `${ROUTES.confirmEmail}?token=${encodeURIComponent(token)}`;
  if (view === CONFIRMATION_VIEWS.signIn) redirect(toSignInPath(path));

  const community = await readBrandingForPage();
  return (
    <SplitLayout
      community={community}
      note={<CommunityNote community={community}>This is a private community, open by invitation.</CommunityNote>}
    >
      <div className="flex min-h-[60dvh] items-center justify-center lg:min-h-[calc(100dvh-140px)]">
        <ConfirmEmailPanel
          view={view}
          token={token}
          path={path}
          accountName={session?.user.name ?? ""}
          accountEmail={session?.user.email ?? ""}
        />
      </div>
    </SplitLayout>
  );
}
