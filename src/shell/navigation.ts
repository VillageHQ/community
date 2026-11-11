import "server-only";

import { ArrowLeftRight, BookUser, Building2, CalendarCheck, FileChartColumn, Gift, Hand, Inbox, LayoutDashboard, Newspaper, Search, Settings2, UserRound, UserRoundPlus, Users, type LucideIcon } from "lucide-react";
import { createElement } from "react";

import { ASKS_ADMIN_PAGE } from "@/modules/asks/contract";
import { JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { MODULES } from "@/modules/registry";
import { ROUTES } from "@/platform/http/routes";
import { NAVIGATION_SECTIONS, type NavigationSection } from "@/platform/modules/manifest";

import { CONSOLE_KEYS, MEMBER_KEYS, NAVIGATION_BADGES, type ShellNavigation, type ShellNavigationItem } from "./navigation-rules";

type MenuEntry = Omit<ShellNavigationItem, "icon" | "href"> & {
  icon: LucideIcon;
  // The module that must be on for the entry to show; none = always.
  moduleId?: string;
  // Where it goes: the module's own menu entry when it has one (so a renamed route follows), else this.
  href?: string;
};

// Founderhall's member menu, in its order: Today · Asks & updates · Search · Directory · Jobs · Intros · Inbox ·
// [Perks] · My profile. Six of them are phone tabs.
const MEMBER_MENU: readonly MenuEntry[] = [
  { key: MEMBER_KEYS.today, label: "Today", tabLabel: "Today", icon: CalendarCheck, href: ROUTES.today },
  { key: MEMBER_KEYS.asks, label: "Asks & updates", tabLabel: "Asks", icon: Hand, moduleId: "asks", badge: NAVIGATION_BADGES.asks },
  // Community's switchable feed (off by default; Founderhall has none): its own page, listed only while it's on.
  { key: MEMBER_KEYS.feed, label: "Feed", icon: Newspaper, moduleId: "feed" },
  { key: MEMBER_KEYS.search, label: "Search", tabLabel: "Search", icon: Search, moduleId: "network" },
  { key: MEMBER_KEYS.directory, label: "Directory", tabLabel: "Directory", icon: BookUser, moduleId: "members" },
  { key: MEMBER_KEYS.jobs, label: "Jobs", icon: Building2, moduleId: "job-board" },
  { key: MEMBER_KEYS.intros, label: "Intros", tabLabel: "Intros", icon: ArrowLeftRight, moduleId: "intros", badge: NAVIGATION_BADGES.intros },
  { key: MEMBER_KEYS.inbox, label: "Inbox", tabLabel: "Inbox", icon: Inbox, moduleId: "messages", badge: NAVIGATION_BADGES.messages },
  { key: MEMBER_KEYS.perks, label: "Perks", icon: Gift, moduleId: "perks" },
  { key: MEMBER_KEYS.me, label: "My profile", icon: UserRound, href: ROUTES.editCard },
];

// Founderhall's console menu: Home · Partner report · Intro log · Members · Invites · Asks & digest · Job board · Set up.
// Set up leads to Settings, where the setup checklist and the plumbing pages start, until the Set up list is built.
const CONSOLE_MENU: readonly MenuEntry[] = [
  { key: CONSOLE_KEYS.home, label: "Home", tabLabel: "Home", icon: LayoutDashboard, href: ROUTES.admin },
  { key: CONSOLE_KEYS.report, label: "Partner report", icon: FileChartColumn, href: ROUTES.adminReport },
  { key: CONSOLE_KEYS.introLog, label: "Intro log", tabLabel: "Intros", icon: ArrowLeftRight, moduleId: "intros", href: ROUTES.adminIntroLog },
  { key: CONSOLE_KEYS.members, label: "Members", tabLabel: "Members", icon: Users, href: ROUTES.adminMembers },
  { key: CONSOLE_KEYS.invites, label: "Invites", icon: UserRoundPlus, href: ROUTES.adminInvites },
  { key: CONSOLE_KEYS.asks, label: "Asks & digest", tabLabel: "Asks", icon: Hand, moduleId: "asks", href: ASKS_ADMIN_PAGE },
  { key: CONSOLE_KEYS.jobs, label: "Job board", icon: Building2, moduleId: "job-board", href: JOB_BOARD_PAGES.admin },
  { key: CONSOLE_KEYS.setup, label: "Set up", tabLabel: "Set up", icon: Settings2, href: ROUTES.adminSettings, badge: NAVIGATION_BADGES.admin },
];

const MODULE_ENTRIES = new Map(MODULES.map(({ manifest }) => [manifest.id, manifest.navigation[0]]));

const ALL_MODULE_IDS: ReadonlySet<string> = new Set(MODULES.map(({ manifest }) => manifest.id));

function readEntries(menu: readonly MenuEntry[], enabledIds: ReadonlySet<string>) {
  return menu.flatMap(({ moduleId, href, ...entry }) => {
    if (moduleId && !enabledIds.has(moduleId)) return [];
    const moduleEntry = moduleId ? MODULE_ENTRIES.get(moduleId) : undefined;
    const resolvedHref = href ?? moduleEntry?.href;
    if (!resolvedHref) return [];
    return [{ ...entry, href: resolvedHref, ...(moduleEntry?.isFullPageLoad ? { isFullPageLoad: true } : {}) }];
  });
}

// Every entry with every module on: the tests check each one has a page.
export const NAVIGATION = [...readEntries(MEMBER_MENU, ALL_MODULE_IDS), ...readEntries(CONSOLE_MENU, ALL_MODULE_IDS)];

export function selectNavigationItems(section: NavigationSection, isAdmin: boolean, enabledIds = ALL_MODULE_IDS) {
  if (section === NAVIGATION_SECTIONS.admin) return isAdmin ? readEntries(CONSOLE_MENU, enabledIds) : [];
  return readEntries(MEMBER_MENU, enabledIds);
}

function renderIcons(entries: ReturnType<typeof readEntries>): ShellNavigationItem[] {
  return entries.map(({ icon, ...entry }) => ({ ...entry, icon: createElement(icon, { "aria-hidden": true, className: "fh-i", strokeWidth: 1.5 }) }));
}

// A server component can't pass a Lucide component to a client one, so the shell gets rendered icons.
export function buildShellNavigation(enabledIds = ALL_MODULE_IDS, isAdmin = false): ShellNavigation {
  return {
    member: renderIcons(readEntries(MEMBER_MENU, enabledIds)),
    console: isAdmin ? renderIcons(readEntries(CONSOLE_MENU, enabledIds)) : [],
  };
}
