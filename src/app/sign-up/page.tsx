import type { Metadata } from "next";

import { PublicMessage } from "@/components/public-page";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/platform/database/client";
import { readBrandingForPage } from "@/platform/branding/branding";
import { isFirstAdminClaimed } from "@/platform/auth/first-admin";
import { ROUTES } from "@/platform/http/routes";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { modulePage } from "@/platform/modules/module-page";

export const dynamic = "force-dynamic";

const CLOSED_NOTICES = {
  awaitingFirstAdmin: {
    description: "This community has no admin yet. Whoever deployed it can finish setup.",
    linkText: "Go to setup",
    href: ROUTES.setup,
  },
  inviteOnly: {
    description: "This community is invite-only. Ask an admin for an invite link, and you'll be right in.",
    linkText: "Sign in",
    href: ROUTES.signIn,
  },
};

export const metadata: Metadata = { title: PAGE_TITLES.signUp };

// Community-only: there is no sign-up. Founderhall's message page, like its 404.
export default modulePage(PLATFORM_MANIFEST, async function SignUpPage() {
  const isClaimed = await isFirstAdminClaimed(getDatabase());
  const notice = isClaimed ? CLOSED_NOTICES.inviteOnly : CLOSED_NOTICES.awaitingFirstAdmin;
  const community = await readBrandingForPage();

  return (
    <PublicMessage
      community={community}
      title="Sign-up is closed"
      action={
        <Button asChild variant="secondary">
          <a href={notice.href}>{notice.linkText}</a>
        </Button>
      }
    >
      {notice.description}
    </PublicMessage>
  );
});
