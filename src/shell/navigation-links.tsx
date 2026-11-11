"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { askCountsQuery } from "@/modules/asks/queries";
import { introCountsQuery } from "@/modules/intros/queries";
import { unreadCountQuery } from "@/modules/messages/queries";
import { ROUTES } from "@/platform/http/routes";

import {
  CONSOLE_TAB_ORDER,
  describeBadge,
  describeNavigationBadge,
  NAVIGATION_BADGES,
  readConsoleKey,
  readConsoleTabKey,
  readMemberKey,
  readMemberTabKey,
  readShellMode,
  SHELL_MODES,
  type NavigationBadgeCounts,
  type ShellMode,
  type ShellNavigation,
  type ShellNavigationItem,
} from "./navigation-rules";

// A plain link where the page needs a full load (its own security headers), the app's link elsewhere.
function NavigationLink({ isFullPageLoad, ...linkProps }: ComponentProps<typeof Link> & { href: string; isFullPageLoad?: boolean }) {
  return isFullPageLoad ? <a {...linkProps} /> : <Link {...linkProps} />;
}

// The parts page shows the menus at a fixed address; everywhere else they follow the page.
export function useShellMode(isAdmin: boolean, pathnameOverride?: string): ShellMode {
  const pathname = usePathname();
  return readShellMode(pathnameOverride ?? pathname, isAdmin);
}

function hasBadge(items: readonly ShellNavigationItem[], badge: string) {
  return items.some((item) => item.badge === badge);
}

function useLiveBadges(items: readonly ShellNavigationItem[], badges: NavigationBadgeCounts): NavigationBadgeCounts {
  const { data } = useQuery({
    ...unreadCountQuery(),
    enabled: hasBadge(items, NAVIGATION_BADGES.messages),
    initialData: { unreadCount: badges[NAVIGATION_BADGES.messages] ?? 0 },
  });
  const { data: introCounts } = useQuery({
    ...introCountsQuery(),
    enabled: hasBadge(items, NAVIGATION_BADGES.intros),
    initialData: { waitingOnYou: badges[NAVIGATION_BADGES.intros] ?? 0, updates: 0, outcomesDue: 0 },
  });
  const { data: askCounts } = useQuery({
    ...askCountsQuery(),
    enabled: hasBadge(items, NAVIGATION_BADGES.asks),
    initialData: { newOffers: badges[NAVIGATION_BADGES.asks] ?? 0 },
  });
  return {
    ...badges,
    [NAVIGATION_BADGES.messages]: data.unreadCount,
    [NAVIGATION_BADGES.intros]: introCounts.waitingOnYou + introCounts.updates + introCounts.outcomesDue,
    [NAVIGATION_BADGES.asks]: askCounts.newOffers,
  };
}

type NavigationBadgeProps = { count: number | undefined; description?: string };

// A count beside a menu item or on a tab: Founderhall's small Ink badge.
export function NavigationBadge({ count, description }: NavigationBadgeProps) {
  if (!count) return null;
  return (
    <span role="img" aria-label={description ?? describeBadge(count)} className="fh-badge">
      {count}
    </span>
  );
}

function ItemBadge({ item, badges }: { item: ShellNavigationItem; badges: NavigationBadgeCounts }) {
  const count = item.badge ? badges[item.badge] : undefined;
  return <NavigationBadge count={count} description={item.badge && count ? describeNavigationBadge(item.badge, count) : undefined} />;
}

type ShellNavigationProps = { navigation: ShellNavigation; isAdmin: boolean; badges: NavigationBadgeCounts; pathname?: string };

function useCurrentItems({ navigation, isAdmin, pathname: pathnameOverride }: Omit<ShellNavigationProps, "badges">) {
  const currentPathname = usePathname();
  const pathname = pathnameOverride ?? currentPathname;
  const mode = readShellMode(pathname, isAdmin);
  const items = mode === SHELL_MODES.console ? navigation.console : navigation.member;
  const currentKey = mode === SHELL_MODES.console ? readConsoleKey(pathname) : readMemberKey(pathname, items);
  const currentTabKey = mode === SHELL_MODES.console ? readConsoleTabKey(pathname) : readMemberTabKey(pathname, items);
  return { mode, items, currentKey, currentTabKey };
}

// The sidebar's menu (crops shell-sidebar-member.png, shell-sidebar-admin.png): a group label, then flat links; the
// current one is a Leaf pill with its icon in the fund colour.
export function SidebarNavigation({ navigation, isAdmin, badges, pathname }: ShellNavigationProps) {
  const { mode, items, currentKey } = useCurrentItems({ navigation, isAdmin, pathname });
  const liveBadges = useLiveBadges(items, badges);
  return (
    <nav aria-label="Main">
      <div className="fh-grp">{mode === SHELL_MODES.console ? "Console" : "Members"}</div>
      {items.map((item) => (
        <NavigationLink
          key={item.key}
          href={item.href}
          isFullPageLoad={item.isFullPageLoad}
          aria-current={item.key === currentKey ? "page" : undefined}
        >
          {item.icon}
          <span>{item.label}</span>
          <ItemBadge item={item} badges={liveBadges} />
        </NavigationLink>
      ))}
    </nav>
  );
}

// The console's tabs keep Founderhall's order (Home · Intros · Asks · Members · Set up), not the sidebar's.
function orderTabs(tabs: readonly ShellNavigationItem[], mode: ShellMode) {
  if (mode !== SHELL_MODES.console) return tabs;
  return [...tabs].sort((first, second) => CONSOLE_TAB_ORDER.indexOf(first.key) - CONSOLE_TAB_ORDER.indexOf(second.key));
}

// The phone's bottom bar (crops shell-tabbar-member-phone.png, shell-tabbar-admin-phone.png): equal columns, an icon
// over an 11 px label; the current tab takes the fund colour and a 2 px bar on its top edge. An admin's last tab
// switches mode, in Ink.
export function TabBar({ navigation, isAdmin, badges, pathname }: ShellNavigationProps) {
  const { mode, items, currentTabKey } = useCurrentItems({ navigation, isAdmin, pathname });
  const tabs = orderTabs(items.filter((item) => item.tabLabel), mode);
  const liveBadges = useLiveBadges(tabs, badges);
  const columns = tabs.length + (isAdmin ? 1 : 0);
  return (
    <nav aria-label="Sections" data-slot="tab-bar" className="fh-tabbar" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {tabs.map((item) => (
        <NavigationLink
          key={item.key}
          href={item.href}
          isFullPageLoad={item.isFullPageLoad}
          aria-current={item.key === currentTabKey ? "page" : undefined}
        >
          {item.icon}
          <span>{item.tabLabel}</span>
          <ItemBadge item={item} badges={liveBadges} />
        </NavigationLink>
      ))}
      {isAdmin && mode === SHELL_MODES.console ? (
        <Link href={ROUTES.feed} className="fh-switch">
          <Eye aria-hidden="true" className="fh-i" strokeWidth={1.5} />
          <span>Founder</span>
        </Link>
      ) : null}
      {isAdmin && mode === SHELL_MODES.member ? (
        <Link href={ROUTES.admin} className="fh-switch">
          <LayoutDashboard aria-hidden="true" className="fh-i" strokeWidth={1.5} />
          <span>Console</span>
        </Link>
      ) : null}
    </nav>
  );
}

// The admin's switch at the top of the sidebar (crop segmented-control.png): Console | View as a founder.
export function ModeSwitch({ pathname }: { pathname?: string }) {
  const mode = useShellMode(true, pathname);
  return (
    <div className="fh-seg fh-block" role="group" aria-label="View">
      <Link className="fh-segbtn" href={ROUTES.admin} aria-current={mode === SHELL_MODES.console ? "true" : undefined}>
        Console
      </Link>
      <Link className="fh-segbtn" href={ROUTES.feed} aria-current={mode === SHELL_MODES.member ? "true" : undefined}>
        View as a founder
      </Link>
    </div>
  );
}

// The founder-view strip (crop shell-founder-view-strip.png): an admin on member pages sees what members see.
export function FounderViewStrip({ name, pathname }: { name: string; pathname?: string }) {
  const mode = useShellMode(true, pathname);
  if (mode === SHELL_MODES.console) return null;
  return (
    <div data-slot="founder-view-strip" className="fh-preview-strip">
      <Eye aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
      <span>
        <b>Founder view.</b> This is what members see. You are signed in as {name}, an admin.
      </span>
      <Link href={ROUTES.admin}>Back to console</Link>
    </div>
  );
}

// "Members", "Admin console" or "Founder view" under the fund's name.
export function useFundMarkSub(isAdmin: boolean, pathname?: string) {
  const mode = useShellMode(isAdmin, pathname);
  if (mode === SHELL_MODES.console) return "Admin console";
  return isAdmin ? "Founder view" : "Members";
}
