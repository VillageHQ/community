import Link from "next/link";

import { PageCard } from "@/components/page-card";
import { getDatabase } from "@/database/client";
import { isFirstAdminClaimed } from "@/lib/first-admin";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

const CLOSED_NOTICES = {
  awaitingFirstAdmin: {
    description: "Sign-up opens to invited members after the first admin finishes setup.",
    linkText: "Go to setup",
    href: ROUTES.setup,
  },
  inviteOnly: {
    description: "This community is invite-only. Ask an admin for access.",
    linkText: "Sign in",
    href: ROUTES.signIn,
  },
};

export default async function SignUpPage() {
  const isClaimed = await isFirstAdminClaimed(getDatabase());
  const notice = isClaimed ? CLOSED_NOTICES.inviteOnly : CLOSED_NOTICES.awaitingFirstAdmin;

  return (
    <PageCard title="Sign-up is closed" description={notice.description}>
      <Link className="text-sm underline" href={notice.href}>
        {notice.linkText}
      </Link>
    </PageCard>
  );
}
