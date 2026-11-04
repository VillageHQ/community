import { House, ShieldCheck, Waypoints, type LucideIcon } from "lucide-react";

import { ROUTES } from "./routes.ts";

export const NAVIGATION_SECTIONS = { primary: "primary", admin: "admin" } as const;
export const NAVIGATION_BADGES = { admin: "admin" } as const;

type NavigationBadge = (typeof NAVIGATION_BADGES)[keyof typeof NAVIGATION_BADGES];

export type NavigationBadgeCounts = Partial<Record<NavigationBadge, number>>;

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  section: (typeof NAVIGATION_SECTIONS)[keyof typeof NAVIGATION_SECTIONS];
  badge?: NavigationBadge;
};

export const NAVIGATION = {
  home: { label: "Home", href: ROUTES.home, icon: House, section: NAVIGATION_SECTIONS.primary },
  network: { label: "Network", href: ROUTES.network, icon: Waypoints, section: NAVIGATION_SECTIONS.primary },
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
  if (href === ROUTES.home) return pathname === ROUTES.home;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function describeBadge(count: number) {
  return `${count} need${count === 1 ? "s" : ""} your attention`;
}
