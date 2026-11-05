import type { ReactNode } from "react";

import { QueryProvider } from "@/components/query-provider";
import { readAvatarUrl } from "@/modules/members/service-profile";
import { messagesManifest } from "@/modules/messages/manifest";
import { MessagesSlotProvider } from "@/modules/messages/components/messages-slot-provider";
import { networkManifest } from "@/modules/network/manifest";
import { requireMember } from "@/platform/auth/session";
import { isAdminMember } from "@/platform/auth/roles";
import { readBrandingForPage } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { EnabledModulesProvider } from "@/platform/modules/enabled-modules";
import { AppShell } from "@/shell/app-shell";
import { readEnabledIds, readModuleBadges } from "@/shell/enabled-modules";
import { buildShellNavigation } from "@/shell/navigation";
import { readNavigationBadges } from "@/shell/navigation-badges";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { id, name, email, role } = await requireMember();
  const { name: communityName, descriptor, logo } = await readBrandingForPage();
  const isAdmin = isAdminMember({ id, email, role });
  const database = getDatabase();
  const enabledIds = await readEnabledIds(database);
  const [adminBadges, moduleBadges, avatarUrl] = await Promise.all([
    isAdmin ? readNavigationBadges(database, process.env) : {},
    readModuleBadges(database, id, enabledIds),
    readAvatarUrl(database, id),
  ]);

  const shell = (
    <AppShell
      community={{ name: communityName, descriptor, logo }}
      member={{ id, name, email, image: avatarUrl, isAdmin }}
      navigation={buildShellNavigation(enabledIds)}
      badges={{ ...adminBadges, ...moduleBadges }}
      isNetworkOn={enabledIds.has(networkManifest.id)}
    >
      {children}
    </AppShell>
  );

  return (
    <QueryProvider>
      <EnabledModulesProvider ids={[...enabledIds]}>
        {enabledIds.has(messagesManifest.id) ? <MessagesSlotProvider>{shell}</MessagesSlotProvider> : shell}
      </EnabledModulesProvider>
    </QueryProvider>
  );
}
