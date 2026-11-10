import type { ReactNode } from "react";

import { LogoTile } from "@/components/logo-tile";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { SiteFooter, SourceCodeLink } from "@/components/source-code-link";
import type { NavigationBadgeCounts, ShellNavigationItem } from "./navigation-rules";

import { SidebarNavigation, TabBar } from "./navigation-links";
import { ModuleOffNotice } from "./module-off-notice";
import { SearchReadyNotice } from "./search-ready-notice";
import { PhoneUserMenu, SidebarUserMenu, type ShellMember } from "./user-menu";
import type { CommunityLogo } from "@/platform/branding/branding";

type ShellCommunity = { name: string; descriptor: string; logo: CommunityLogo | null };

type AppShellProps = {
  community: ShellCommunity;
  member: ShellMember;
  navigation: readonly ShellNavigationItem[];
  badges: NavigationBadgeCounts;
  isNetworkOn: boolean;
  children: ReactNode;
};

export function AppShell({ community, member, navigation, badges, isNetworkOn, children }: AppShellProps) {
  return (
    <div data-slot="app-shell" className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside data-slot="sidebar" aria-label="Community" className="hidden border-r lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-1 overflow-y-auto px-4 pt-6 pb-5">
          <div className="flex items-center gap-3 px-2 pb-5">
            <LogoTile name={community.name} logo={community.logo} sizePx={46} />
            <div className="min-w-0">
              {/* A long fund name keeps to three lines; the full name is in the tooltip. */}
              <div title={community.name} className="type-serif line-clamp-3 text-lg leading-[22px] wrap-anywhere">
                {community.name}
              </div>
              {community.descriptor ? (
                <div className="type-micro text-muted-foreground">{community.descriptor}</div>
              ) : null}
            </div>
          </div>
          <SidebarNavigation items={navigation} isAdmin={member.isAdmin} badges={badges} />
          <div className="mt-auto flex flex-col gap-3 pt-6">
            <SidebarUserMenu member={member} />
            <div data-slot="sidebar-source" className="type-micro px-3 font-normal text-muted-foreground">
              <SourceCodeLink />
            </div>
          </div>
        </div>
      </aside>
      <header
        data-slot="phone-top-bar"
        className="sticky top-0 z-10 flex min-h-[68px] items-center gap-2.5 bg-background px-3.5 py-3 lg:hidden"
      >
        <LogoTile name={community.name} logo={community.logo} sizePx={38} />
        <span title={community.name} className="type-serif min-w-0 flex-1 truncate text-[19px] leading-[24px]">
          {community.name}
        </span>
        <PhoneUserMenu member={member} adminBadgeCount={badges.admin} />
      </header>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-w-0 px-3.5 pt-2 pb-32 lg:px-10 lg:pt-9 lg:pb-12">
        <div data-slot="page-width" className="mx-auto w-full max-w-[1040px]">
          {children}
          <SiteFooter name={community.name} />
        </div>
      </main>
      {isNetworkOn ? <SearchReadyNotice /> : null}
      <ModuleOffNotice />
      <TabBar items={navigation} badges={badges} />
    </div>
  );
}
