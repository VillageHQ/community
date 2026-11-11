import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PublicPage } from "@/components/public-page";
import { getDatabase } from "@/platform/database/client";
import { readActiveSession } from "@/platform/auth/active-session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readConfirmationView } from "@/modules/members/service-email-confirmation";
import { CONFIRMATION_VIEWS } from "@/modules/members/contract-email-confirmation";
import { toSignInPath } from "@/platform/http/return-path";
import { ROUTES } from "@/platform/http/routes";

import { ConfirmEmailPanel } from "./confirm-email-panel";
import { membersManifest } from "@/modules/members/manifest";
import { networkManifest } from "@/modules/network/manifest";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { modulePage } from "@/platform/modules/module-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.confirmEmail, robots: { index: false, follow: false } };

type ConfirmEmailPageProps = { searchParams: Promise<{ token?: string }> };

export default modulePage(membersManifest, async function ConfirmEmailPage({ searchParams }: ConfirmEmailPageProps) {
  const { token = "" } = await searchParams;
  const session = await readActiveSession(await headers());
  const view = await readConfirmationView(getDatabase(), token, session?.user ?? null);
  const path = `${ROUTES.confirmEmail}?token=${encodeURIComponent(token)}`;
  if (view === CONFIRMATION_VIEWS.signIn) redirect(toSignInPath(path));

  const [community, isNetworkOn] = await Promise.all([readBrandingForPage(), isModuleEnabled(getDatabase(), networkManifest)]);
  return (
    <PublicPage community={community}>
      <ConfirmEmailPanel
          view={view}
          token={token}
          path={path}
          accountName={session?.user.name ?? ""}
          accountEmail={session?.user.email ?? ""}
        isNetworkOn={isNetworkOn}
      />
    </PublicPage>
  );
});
