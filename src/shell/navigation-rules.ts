import type { ReactNode } from "react";

import { ASKS_ADMIN_PAGE, describeNewOffers } from "@/modules/asks/contract";
import { JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { describeUnreadMessages } from "@/modules/messages/contract";
import { ROUTES } from "@/platform/http/routes";

export const NAVIGATION_BADGES = { admin: "admin", messages: "messages", intros: "intros", asks: "asks" } as const;

export type NavigationBadgeCounts = Partial<Record<string, number>>;

// Founderhall's two menus (its lib/html.mjs MEMBER_NAV and CONSOLE_NAV). A key names the item, so the phone tab a
// page lights can differ from its sidebar item (Jobs lights Directory; the Partner report lights Intros).
export const MEMBER_KEYS = {
  today: "today",
  asks: "asks",
  search: "search",
  directory: "directory",
  jobs: "jobs",
  intros: "intros",
  inbox: "inbox",
  perks: "perks",
  me: "me",
} as const;

export const CONSOLE_KEYS = {
  home: "home",
  report: "report",
  introLog: "intro-log",
  members: "members",
  invites: "invites",
  asks: "asks-digest",
  jobs: "job-board",
  setup: "setup",
} as const;

export type ShellNavigationItem = {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  // The shorter label on the phone tab bar ("Asks" for "Asks & updates"); no tabLabel = no tab.
  tabLabel?: string;
  badge?: string;
  isFullPageLoad?: boolean;
};

type MenuPlace = { key: string; href: string };

export type ShellNavigation = { member: readonly ShellNavigationItem[]; console: readonly ShellNavigationItem[] };

export const SHELL_MODES = { member: "member", console: "console" } as const;

export type ShellMode = (typeof SHELL_MODES)[keyof typeof SHELL_MODES];

function isUnder(pathname: string, href: string) {
  if (href === ROUTES.feed) return pathname === ROUTES.feed;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavigationItemActive(href: string, pathname: string) {
  return isUnder(pathname, href);
}

// The console is every page under /admin; an admin anywhere else sees the founder view.
export function readShellMode(pathname: string, isAdmin: boolean): ShellMode {
  return isAdmin && isUnder(pathname, ROUTES.admin) ? SHELL_MODES.console : SHELL_MODES.member;
}

const CONSOLE_PATHS: readonly (readonly [string, string])[] = [
  [ROUTES.adminReport, CONSOLE_KEYS.report],
  [ROUTES.adminHealth, CONSOLE_KEYS.report],
  [ROUTES.adminIntroLog, CONSOLE_KEYS.introLog],
  [ROUTES.adminMembers, CONSOLE_KEYS.members],
  [ROUTES.adminInvites, CONSOLE_KEYS.invites],
  [ASKS_ADMIN_PAGE, CONSOLE_KEYS.asks],
  [ROUTES.adminWeeklyEmail, CONSOLE_KEYS.asks],
  [ROUTES.adminDigest, CONSOLE_KEYS.asks],
  [JOB_BOARD_PAGES.admin, CONSOLE_KEYS.jobs],
];

// Which console item a page lights. Set up also lights for its plumbing pages (Settings, Email, Village, Credits,
// Slack and Discord, Perks, Audit log, Features, Reports) and for the setup checklist.
export function readConsoleKey(pathname: string) {
  if (pathname === ROUTES.admin) return CONSOLE_KEYS.home;
  if (isUnder(pathname, ROUTES.adminInvites)) return CONSOLE_KEYS.invites;
  return CONSOLE_PATHS.find(([href]) => isUnder(pathname, href))?.[1] ?? CONSOLE_KEYS.setup;
}

// The console's phone tabs: Home · Intros · Asks · Members · Set up. The Partner report lives under Intros;
// Invites and the Job board under Members.
const CONSOLE_TAB_OF: Partial<Record<string, string>> = {
  [CONSOLE_KEYS.report]: CONSOLE_KEYS.introLog,
  [CONSOLE_KEYS.invites]: CONSOLE_KEYS.members,
  [CONSOLE_KEYS.jobs]: CONSOLE_KEYS.members,
};

export const CONSOLE_TAB_ORDER: readonly string[] = [CONSOLE_KEYS.home, CONSOLE_KEYS.introLog, CONSOLE_KEYS.asks, CONSOLE_KEYS.members, CONSOLE_KEYS.setup];

export function readConsoleTabKey(pathname: string) {
  const key = readConsoleKey(pathname);
  return CONSOLE_TAB_OF[key] ?? key;
}

// Which member item a page lights: the longest menu address the page sits under. My profile and Your data light
// My profile, never Directory.
export function readMemberKey(pathname: string, items: readonly MenuPlace[]) {
  if (isUnder(pathname, ROUTES.editCard) || isUnder(pathname, ROUTES.yourData)) return MEMBER_KEYS.me;
  // A first message (/messages/new) belongs to the Inbox, as in Founderhall.
  if (isUnder(pathname, ROUTES.newMessage)) return MEMBER_KEYS.inbox;
  const matches = items.filter(({ href }) => isUnder(pathname, href));
  return matches.sort((first, second) => second.href.length - first.href.length)[0]?.key ?? null;
}

// The member phone tabs: Jobs lights Directory; My profile and Your data light nothing (the avatar opens them).
const MEMBER_TAB_OF: Partial<Record<string, string | null>> = { [MEMBER_KEYS.jobs]: MEMBER_KEYS.directory, [MEMBER_KEYS.me]: null };

export function readMemberTabKey(pathname: string, items: readonly MenuPlace[]) {
  const key = readMemberKey(pathname, items);
  if (key === null) return null;
  return key in MEMBER_TAB_OF ? (MEMBER_TAB_OF[key] ?? null) : key;
}

export function describeBadge(count: number) {
  return `${count} need${count === 1 ? "s" : ""} your attention`;
}

export function describeIntroBadge(count: number) {
  return count === 1 ? "1 intro needs a look" : `${count} intros need a look`;
}

const BADGE_DESCRIPTIONS: Partial<Record<string, (count: number) => string>> = {
  [NAVIGATION_BADGES.admin]: describeBadge,
  [NAVIGATION_BADGES.messages]: describeUnreadMessages,
  [NAVIGATION_BADGES.intros]: describeIntroBadge,
  [NAVIGATION_BADGES.asks]: describeNewOffers,
};

export function describeNavigationBadge(badge: string, count: number) {
  return (BADGE_DESCRIPTIONS[badge] ?? describeBadge)(count);
}
