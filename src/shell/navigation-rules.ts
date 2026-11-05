import type { ReactNode } from "react";

import { describeUnreadMessages } from "@/modules/messages/contract";
import type { NavigationSection } from "@/platform/modules/manifest";
import { ROUTES } from "@/platform/http/routes";

export const NAVIGATION_BADGES = { admin: "admin", messages: "messages", intros: "intros" } as const;

export type NavigationBadgeCounts = Partial<Record<string, number>>;

export type ShellNavigationItem = {
  label: string;
  href: string;
  icon: ReactNode;
  section: NavigationSection;
  badge?: string;
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
};

export function describeNavigationBadge(badge: string, count: number) {
  return (BADGE_DESCRIPTIONS[badge] ?? describeBadge)(count);
}
