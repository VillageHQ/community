import type { ReactNode } from "react";

import { describeNewOffers } from "@/modules/asks/contract";
import { describeUnreadMessages } from "@/modules/messages/contract";
import type { NavigationSection } from "@/platform/modules/manifest";
import { ROUTES } from "@/platform/http/routes";

export const NAVIGATION_BADGES = { admin: "admin", messages: "messages", intros: "intros", asks: "asks" } as const;

const TAB_BAR_CAPACITY = 5;

export type NavigationBadgeCounts = Partial<Record<string, number>>;

export type ShellNavigationItem = {
  label: string;
  href: string;
  icon: ReactNode;
  section: NavigationSection;
  badge?: string;
  isFullPageLoad?: boolean;
};

export function isNavigationItemActive(href: string, pathname: string) {
  if (href === ROUTES.feed) return pathname === ROUTES.feed;
  return pathname === href || pathname.startsWith(`${href}/`);
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

// The last tab becomes "More" only when the items don't all fit, so a small community keeps its plain bar.
export function splitTabBarItems(items: readonly ShellNavigationItem[]) {
  if (items.length <= TAB_BAR_CAPACITY) return { tabs: items, overflow: [] };
  return { tabs: items.slice(0, TAB_BAR_CAPACITY - 1), overflow: items.slice(TAB_BAR_CAPACITY - 1) };
}

export function sumBadges(items: readonly ShellNavigationItem[], badges: NavigationBadgeCounts) {
  return items.reduce((total, { badge }) => total + (badge ? (badges[badge] ?? 0) : 0), 0);
}
