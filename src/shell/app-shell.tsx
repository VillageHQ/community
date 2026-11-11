import type { ReactNode } from "react";

import { FlashProvider, FlashSlot } from "@/components/flash";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import type { CommunityLogo } from "@/platform/branding/branding";

import { ModuleOffNotice } from "./module-off-notice";
import { FounderViewStrip, ModeSwitch, SidebarNavigation, TabBar } from "./navigation-links";
import type { NavigationBadgeCounts, ShellNavigation } from "./navigation-rules";
import { SearchReadyNotice } from "./search-ready-notice";
import { PhoneFoot, ShellFooterLine, ShellFundMark } from "./shell-chrome";
import { PhoneProfileLink, SidebarMember, type ShellMember } from "./user-menu";

type ShellCommunity = { name: string; descriptor: string; logo: CommunityLogo | null };

type AppShellProps = {
  community: ShellCommunity;
  member: ShellMember;
  navigation: ShellNavigation;
  badges: NavigationBadgeCounts;
  isNetworkOn: boolean;
  children: ReactNode;
};

// Founderhall's page shell (its lib/html.mjs page(), design-system.md §2): from 1000 px a 264 px sidebar (fund mark,
// the admin's Console | View as a founder switch, the menu, the member and Sign out, the footer line); below it a
// 56 px top bar and a 64 px tab bar. An admin on member pages sees the founder-view strip.
export function AppShell({ community, member, navigation, badges, isNetworkOn, children }: AppShellProps) {
  return (
    <FlashProvider>
      <div data-slot="app-shell" className="fh-app">
        <aside data-slot="sidebar" aria-label="Navigation" className="fh-side">
          <ShellFundMark name={community.name} logo={community.logo} isAdmin={member.isAdmin} size="sidebar" />
          {member.isAdmin ? <ModeSwitch /> : null}
          <SidebarNavigation navigation={navigation} isAdmin={member.isAdmin} badges={badges} />
          <SidebarMember member={member} />
          <ShellFooterLine isAdmin={member.isAdmin} />
        </aside>
        <div data-slot="shell-column" className="fh-col min-w-0">
          <header data-slot="phone-top-bar" className="fh-topbar">
            <ShellFundMark name={community.name} logo={community.logo} isAdmin={member.isAdmin} size="default" />
            <span className="fh-spacer" />
            <PhoneProfileLink member={member} />
          </header>
          {member.isAdmin ? <FounderViewStrip name={member.name} /> : null}
          <main id={MAIN_CONTENT_ID} tabIndex={-1} data-slot="main" className="fh-main">
            <FlashSlot />
            <div data-slot="page-width" className="w-full">
              {children}
            </div>
            <PhoneFoot isAdmin={member.isAdmin} navigation={navigation} />
          </main>
        </div>
        {isNetworkOn ? <SearchReadyNotice /> : null}
        <ModuleOffNotice />
        <TabBar navigation={navigation} isAdmin={member.isAdmin} badges={badges} />
      </div>
    </FlashProvider>
  );
}
