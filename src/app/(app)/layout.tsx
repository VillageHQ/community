import type { ReactNode } from "react";

import { QueryProvider } from "@/components/query-provider";
import { AppShell } from "@/components/shell/app-shell";
import { getDatabase } from "@/database/client";
import { readBrandingForPage } from "@/lib/branding/branding";
import { readAvatarUrl } from "@/lib/members/profile";
import { readUnreadCount } from "@/lib/messages/message-reads";
import { readNavigationBadges } from "@/lib/navigation-badges";
import { requireMember } from "@/lib/session";
import { isAdminMember } from "@/lib/village/member-network";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { id, name, email, role } = await requireMember();
  const { name: communityName, descriptor, logo } = await readBrandingForPage();
  const isAdmin = isAdminMember({ id, email, role });
  const database = getDatabase();
  const [adminBadges, unreadMessages, avatarUrl] = await Promise.all([
    isAdmin ? readNavigationBadges(database, process.env) : {},
    readUnreadCount(database, id),
    readAvatarUrl(database, id),
  ]);

  return (
    <QueryProvider>
      <AppShell
        community={{ name: communityName, descriptor, logo }}
        member={{ id, name, email, image: avatarUrl, isAdmin }}
        badges={{ ...adminBadges, messages: unreadMessages }}
      >
        {children}
      </AppShell>
    </QueryProvider>
  );
}
