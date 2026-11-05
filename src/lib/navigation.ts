import { Handshake, House, MessageCircle, ShieldCheck, Users, Waypoints, type LucideIcon } from "lucide-react";

import { ROUTES } from "../platform/http/routes.ts";

export const NAVIGATION_SECTIONS = { primary: "primary", admin: "admin" } as const;
export const NAVIGATION_BADGES = { admin: "admin", messages: "messages", intros: "intros" } as const;

export type NavigationBadge = (typeof NAVIGATION_BADGES)[keyof typeof NAVIGATION_BADGES];

export type NavigationBadgeCounts = Partial<Record<NavigationBadge, number>>;

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  section: (typeof NAVIGATION_SECTIONS)[keyof typeof NAVIGATION_SECTIONS];
  badge?: NavigationBadge;
};

export const NAVIGATION = {
  feed: { label: "Feed", href: ROUTES.feed, icon: House, section: NAVIGATION_SECTIONS.primary },
  messages: {
    label: "Messages",
    href: ROUTES.messages,
    icon: MessageCircle,
    section: NAVIGATION_SECTIONS.primary,
    badge: NAVIGATION_BADGES.messages,
  },
  members: { label: "Members", href: ROUTES.members, icon: Users, section: NAVIGATION_SECTIONS.primary },
  network: { label: "Network", href: ROUTES.network, icon: Waypoints, section: NAVIGATION_SECTIONS.primary },
  intros: {
    label: "Intros",
    href: ROUTES.intros,
    icon: Handshake,
    section: NAVIGATION_SECTIONS.primary,
    badge: NAVIGATION_BADGES.intros,
  },
  admin: {
    label: "Admin",
    href: ROUTES.admin,
    icon: ShieldCheck,
    section: NAVIGATION_SECTIONS.admin,
    badge: NAVIGATION_BADGES.admin,
  },
} satisfies Record<string, NavigationItem>;

const NAVIGATION_ITEMS: NavigationItem[] = Object.values(NAVIGATION);

export function selectNavigationItems(section: NavigationItem["section"], isAdmin: boolean) {
  if (section === NAVIGATION_SECTIONS.admin && !isAdmin) return [];
  return NAVIGATION_ITEMS.filter((item) => item.section === section);
}

export function isNavigationItemActive(href: string, pathname: string) {
  if (href === ROUTES.feed) return pathname === ROUTES.feed;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function describeBadge(count: number) {
  return `${count} need${count === 1 ? "s" : ""} your attention`;
}

export function describeUnreadMessages(count: number) {
  return count === 1 ? "1 unread message" : `${count} unread messages`;
}

export function describeIntroBadge(count: number) {
  return count === 1 ? "1 intro needs a look" : `${count} intros need a look`;
}

const BADGE_DESCRIPTIONS: Record<NavigationBadge, (count: number) => string> = {
  [NAVIGATION_BADGES.admin]: describeBadge,
  [NAVIGATION_BADGES.messages]: describeUnreadMessages,
  [NAVIGATION_BADGES.intros]: describeIntroBadge,
};

export function describeNavigationBadge(badge: NavigationBadge, count: number) {
  return BADGE_DESCRIPTIONS[badge](count);
}
