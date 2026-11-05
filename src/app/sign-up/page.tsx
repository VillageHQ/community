import type { Metadata } from "next";
import { MailOpen } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/database/client";
import { readBrandingForPage } from "@/lib/branding/branding";
import { isFirstAdminClaimed } from "@/lib/first-admin";
import { ROUTES } from "@/lib/routes";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";

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

export default async function SignUpPage() {
  const isClaimed = await isFirstAdminClaimed(getDatabase());
  const notice = isClaimed ? CLOSED_NOTICES.inviteOnly : CLOSED_NOTICES.awaitingFirstAdmin;
  const community = await readBrandingForPage();

  return (
    <SplitLayout
      community={community}
      note={<CommunityNote community={community}>This is a private community.</CommunityNote>}
    >
      <div className="flex min-h-[60dvh] items-center justify-center lg:min-h-[calc(100dvh-140px)]">
        <EmptyState headingLevel="h1" icon={MailOpen} title="Sign-up is closed" description={notice.description}>
          <Button asChild size="lg">
            <Link href={notice.href}>{notice.linkText}</Link>
          </Button>
        </EmptyState>
      </div>
    </SplitLayout>
  );
}
