"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ChevronRight, Ellipsis, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { askCountsQuery } from "@/modules/asks/queries";
import { introCountsQuery } from "@/modules/intros/queries";
import { unreadCountQuery } from "@/modules/messages/queries";
import { NAVIGATION_SECTIONS, type NavigationSection } from "@/platform/modules/manifest";
import {
  describeBadge,
  describeNavigationBadge,
  isNavigationItemActive,
  NAVIGATION_BADGES,
  splitTabBarItems,
  sumBadges,
  type NavigationBadgeCounts,
  type ShellNavigationItem,
} from "./navigation-rules";

type NavigationProps = { items: readonly ShellNavigationItem[]; isAdmin: boolean; badges: NavigationBadgeCounts };

type NavigationBadgeProps = { count: number | undefined; description?: string };

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

function describeCount(badge: string, count: number | undefined) {
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

function SidebarSection({ section, items, badges }: Omit<NavigationProps, "isAdmin"> & { section: NavigationSection }) {
  const pathname = usePathname();
  return items.filter((item) => item.section === section).map(({ label, href, icon, badge }) => (
    <Link
      key={href}
      href={href}
      aria-current={isNavigationItemActive(href, pathname) ? "page" : undefined}
      className={SIDEBAR_LINK}
    >
      {icon}
      {label}
      <NavigationBadge
        count={badge ? badges[badge] : undefined}
        description={badge ? describeCount(badge, badges[badge]) : undefined}
      />
    </Link>
  ));
}

export function SidebarNavigation({ items, isAdmin, badges }: NavigationProps) {
  const liveBadges = useLiveBadges(items, badges);
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      <SidebarSection section={NAVIGATION_SECTIONS.primary} items={items} badges={liveBadges} />
      {isAdmin ? <div className="mx-4 my-3 h-px bg-border" /> : null}
      {isAdmin ? <SidebarSection section={NAVIGATION_SECTIONS.admin} items={items} badges={liveBadges} /> : null}
    </nav>
  );
}

const TAB =
  "type-tab group relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-field text-muted-foreground aria-[current=page]:font-bold aria-[current=page]:text-accent-foreground";

const TAB_BADGE =
  "type-tab absolute top-0 left-1/2 ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-[5px] font-bold text-primary-foreground shadow-[0_0_0_2px_var(--card)]";

function TabIcon({ isActive, children }: { isActive: boolean; children: ReactNode }) {
  return <span className={cn("flex h-[30px] w-[52px] items-center justify-center rounded-full [&_svg]:size-icon", isActive && "bg-accent")}>{children}</span>;
}

const OVERFLOW_ROW =
  "flex min-h-14 w-full items-center gap-3.5 rounded-input px-4 text-base leading-5 font-semibold hover:bg-muted aria-[current=page]:bg-accent aria-[current=page]:font-bold aria-[current=page]:text-accent-foreground [&_svg]:size-icon [&_svg]:shrink-0";

type MoreTabProps = { items: readonly ShellNavigationItem[]; badges: NavigationBadgeCounts; pathname: string };

function MoreTab({ items, badges, pathname }: MoreTabProps) {
  const isActive = items.some(({ href }) => isNavigationItemActive(href, pathname));
  const badgeTotal = sumBadges(items, badges);
  return (
    <Dialog.Root>
      <Dialog.Trigger aria-current={isActive ? "page" : undefined} className={TAB}>
        <TabIcon isActive={isActive}>
          <Ellipsis aria-hidden="true" />
        </TabIcon>
        More
        {badgeTotal ? (
          <span role="img" aria-label={describeBadge(badgeTotal)} className={TAB_BADGE}>
            {badgeTotal}
          </span>
        ) : null}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-[rgb(10_12_10/0.48)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-40 rounded-t-[32px] bg-card px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),24px)] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom lg:hidden"
        >
          <div aria-hidden="true" className="mx-auto mb-3 h-[5px] w-11 rounded-full bg-input" />
          <div className="mb-2 flex items-center justify-between gap-3 pl-4">
            <Dialog.Title className="type-h3">More</Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="quiet" size="icon" aria-label="Close more">
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-1">
            {items.map(({ label, href, icon, badge }) => (
              <Dialog.Close key={href} asChild>
                <Link href={href} aria-current={isNavigationItemActive(href, pathname) ? "page" : undefined} className={OVERFLOW_ROW}>
                  {icon}
                  {label}
                  <NavigationBadge count={badge ? badges[badge] : undefined} description={badge ? describeCount(badge, badges[badge]) : undefined} />
                  <ChevronRight aria-hidden="true" className={badge && badges[badge] ? undefined : "ml-auto"} />
                </Link>
              </Dialog.Close>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function TabBar({ items, badges }: Omit<NavigationProps, "isAdmin">) {
  const pathname = usePathname();
  const liveBadges = useLiveBadges(items, badges);
  const { tabs, overflow } = splitTabBarItems(items.filter((item) => item.section === NAVIGATION_SECTIONS.primary));
  return (
    <nav
      aria-label="Main"
      data-slot="tab-bar"
      className="fixed inset-x-0 bottom-0 z-20 grid auto-cols-fr grid-flow-col bg-card px-2 pt-2 pb-[max(env(safe-area-inset-bottom),14px)] shadow-sheet lg:hidden"
    >
      {tabs.map(({ label, href, icon, badge }) => {
        const isActive = isNavigationItemActive(href, pathname);
        return (
          <Link key={href} href={href} aria-current={isActive ? "page" : undefined} className={TAB}>
            <TabIcon isActive={isActive}>{icon}</TabIcon>
            {label}
            {badge && liveBadges[badge] ? (
              <span role="img" aria-label={describeNavigationBadge(badge, liveBadges[badge])} className={TAB_BADGE}>
                {liveBadges[badge]}
              </span>
            ) : null}
          </Link>
        );
      })}
      {overflow.length > 0 ? <MoreTab items={overflow} badges={liveBadges} pathname={pathname} /> : null}
    </nav>
  );
}
