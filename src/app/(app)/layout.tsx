import type { ReactNode } from "react";

import { QueryProvider } from "@/components/query-provider";
import { AppShell } from "@/components/shell/app-shell";
import { getDatabase } from "@/database/client";
import { readBrandingForPage } from "@/lib/branding/branding";
import { readNavigationBadges } from "@/lib/navigation-badges";
import { requireMember } from "@/lib/session";
import { isAdminMember } from "@/lib/village/member-network";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { id, name, email, image, role } = await requireMember();
  const { name: communityName, descriptor, logo } = await readBrandingForPage();
  const isAdmin = isAdminMember({ id, email, role });
  const badges = isAdmin ? await readNavigationBadges(getDatabase(), process.env) : {};

  return (
    <QueryProvider>
      <AppShell
        community={{ name: communityName, descriptor, logo }}
        member={{ id, name, email, image, isAdmin }}
        badges={badges}
      >
        {children}
      </AppShell>
    </QueryProvider>
  );
}
