import type { ReactNode } from "react";

import { LogoTile } from "@/components/logo-tile";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { NetworkByVillage } from "@/components/village-mark";
import type { NavigationBadgeCounts, ShellNavigationItem } from "./navigation-rules";

import { SidebarNavigation, TabBar } from "./navigation-links";
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
  runsOnVillage: boolean;
  children: ReactNode;
};

export function AppShell({ community, member, navigation, badges, isNetworkOn, runsOnVillage, children }: AppShellProps) {
  return (
    <div data-slot="app-shell" className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside data-slot="sidebar" aria-label="Community" className="hidden border-r lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-1 overflow-y-auto px-4 pt-6 pb-5">
          <div className="flex items-center gap-3 px-2 pb-5">
            <LogoTile name={community.name} logo={community.logo} sizePx={46} />
            <div className="min-w-0">
              <div className="text-lg leading-[22px] font-bold tracking-[-0.012em]">{community.name}</div>
              {community.descriptor ? (
                <div className="type-micro text-muted-foreground">{community.descriptor}</div>
              ) : null}
            </div>
          </div>
          <SidebarNavigation items={navigation} isAdmin={member.isAdmin} badges={badges} />
          <div className="mt-auto flex flex-col gap-3 pt-6">
            <SidebarUserMenu member={member} />
            {runsOnVillage ? (
              <div className="px-3">
                <NetworkByVillage />
              </div>
            ) : null}
          </div>
        </div>
      </aside>
      <header
        data-slot="phone-top-bar"
        className="sticky top-0 z-10 flex min-h-[68px] items-center gap-2.5 bg-background px-3.5 py-3 lg:hidden"
      >
        <LogoTile name={community.name} logo={community.logo} sizePx={38} />
        <span className="min-w-0 flex-1 truncate text-[17px] leading-[22px] font-bold tracking-[-0.012em]">
          {community.name}
        </span>
        <PhoneUserMenu member={member} adminBadgeCount={badges.admin} showsVillageMark={runsOnVillage} />
      </header>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-w-0 px-3.5 pt-2 pb-32 lg:px-10 lg:pt-9 lg:pb-12">
        <div data-slot="page-width" className="mx-auto w-full max-w-[1040px]">
          {children}
        </div>
      </main>
      {isNetworkOn ? <SearchReadyNotice /> : null}
      <TabBar items={navigation} badges={badges} />
    </div>
  );
}
