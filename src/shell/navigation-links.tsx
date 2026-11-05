"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { introCountsQuery } from "@/modules/intros/queries";
import { unreadCountQuery } from "@/modules/messages/queries";
import {
  describeBadge,
  describeNavigationBadge,
  isNavigationItemActive,
  NAVIGATION_BADGES,
  NAVIGATION_SECTIONS,
  selectNavigationItems,
  type NavigationBadge as NavigationBadgeKind,
  type NavigationBadgeCounts,
} from "@/shell/navigation";

type NavigationProps = { isAdmin: boolean; badges: NavigationBadgeCounts };

type NavigationBadgeProps = { count: number | undefined; description?: string };

function useLiveBadges(badges: NavigationBadgeCounts): NavigationBadgeCounts {
  const { data } = useQuery({
    ...unreadCountQuery(),
    initialData: { unreadCount: badges[NAVIGATION_BADGES.messages] ?? 0 },
  });
  const { data: introCounts } = useQuery({
    ...introCountsQuery(),
    initialData: { waitingOnYou: badges[NAVIGATION_BADGES.intros] ?? 0, updates: 0 },
  });
  return {
    ...badges,
    [NAVIGATION_BADGES.messages]: data.unreadCount,
    [NAVIGATION_BADGES.intros]: introCounts.waitingOnYou + introCounts.updates,
  };
}

function describeCount(badge: NavigationBadgeKind, count: number | undefined) {
  return count ? describeNavigationBadge(badge, count) : undefined;
}

export function NavigationBadge({ count, description }: NavigationBadgeProps) {
  if (!count) return null;
  return (
    <span
      role="img"
      aria-label={description ?? describeBadge(count)}
      className="type-micro ml-auto inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-primary px-2 font-bold text-primary-foreground shadow-[inset_0_0_0_1px_var(--brand-edge)]"
    >
      {count}
    </span>
  );
}

const SIDEBAR_LINK =
  "flex min-h-[50px] items-center gap-3.5 rounded-full px-4 text-base leading-5 font-semibold text-foreground-soft hover:bg-muted hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:font-bold aria-[current=page]:text-accent-foreground [&_svg]:size-icon [&_svg]:shrink-0";

function SidebarSection({ section, isAdmin, badges }: NavigationProps & { section: "primary" | "admin" }) {
  const pathname = usePathname();
  return selectNavigationItems(section, isAdmin).map(({ label, href, icon: Icon, badge }) => (
    <Link
      key={href}
      href={href}
      aria-current={isNavigationItemActive(href, pathname) ? "page" : undefined}
      className={SIDEBAR_LINK}
    >
      <Icon aria-hidden="true" />
      {label}
      <NavigationBadge
        count={badge ? badges[badge] : undefined}
        description={badge ? describeCount(badge, badges[badge]) : undefined}
      />
    </Link>
  ));
}

export function SidebarNavigation({ isAdmin, badges }: NavigationProps) {
  const liveBadges = useLiveBadges(badges);
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      <SidebarSection section={NAVIGATION_SECTIONS.primary} isAdmin={isAdmin} badges={liveBadges} />
      {isAdmin ? <div className="mx-4 my-3 h-px bg-border" /> : null}
      <SidebarSection section={NAVIGATION_SECTIONS.admin} isAdmin={isAdmin} badges={liveBadges} />
    </nav>
  );
}

export function TabBar({ badges }: { badges: NavigationBadgeCounts }) {
  const pathname = usePathname();
  const liveBadges = useLiveBadges(badges);
  const items = selectNavigationItems(NAVIGATION_SECTIONS.primary, false);
  return (
    <nav
      aria-label="Main"
      data-slot="tab-bar"
      className="fixed inset-x-0 bottom-0 z-20 grid auto-cols-fr grid-flow-col rounded-t-card bg-card px-2 pt-2 pb-[max(env(safe-area-inset-bottom),14px)] shadow-sheet lg:hidden"
    >
      {items.map(({ label, href, icon: Icon, badge }) => {
        const isActive = isNavigationItemActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className="type-tab group relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-field text-muted-foreground aria-[current=page]:font-bold aria-[current=page]:text-accent-foreground"
          >
            <span className={cn("flex h-[30px] w-[52px] items-center justify-center rounded-full", isActive && "bg-accent")}>
              <Icon aria-hidden="true" className="size-icon" />
            </span>
            {label}
            {badge && liveBadges[badge] ? (
              <span
                role="img"
                aria-label={describeNavigationBadge(badge, liveBadges[badge])}
                className="type-tab absolute top-0 left-1/2 ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-[5px] font-bold text-primary-foreground shadow-[0_0_0_2px_var(--card)]"
              >
                {liveBadges[badge]}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
