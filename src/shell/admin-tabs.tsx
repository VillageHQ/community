"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CHIP_CLASSES } from "@/components/ui/chip";
import { CONSOLE_KEYS, readConsoleKey } from "@/shell/navigation-rules";
import type { AdminTabFacts } from "@/shell/admin-badges";
import { ROUTES } from "@/platform/http/routes";
import { ASKS_ADMIN_PAGE } from "@/modules/asks/contract";

// The console's own menu is the sidebar (and the phone tabs). Community has pages Founderhall's menu has no item for;
// each lights a console item. Set up's pages are reached from its list (/admin/setup), as in Founderhall; the Asks
// item still lists its pages here as a row of chips under the page title, until its area builds Asks & digest.
type AdminTab = { label: string; href: string; readBadge?: (facts: AdminTabFacts) => number; badgeDescription?: (count: number) => string };

const TABS_BY_ITEM: Partial<Record<string, AdminTab[]>> = {
  [CONSOLE_KEYS.asks]: [
    { label: "Asks", href: ASKS_ADMIN_PAGE },
    { label: "Weekly email", href: ROUTES.adminWeeklyEmail },
  ],
};

// Pages whose module is off are hidden (their href is in hiddenTabHrefs).
export function readAdminTabs(consoleKey: string, facts: AdminTabFacts) {
  const tabs = TABS_BY_ITEM[consoleKey] ?? [];
  return tabs.filter(({ href }) => !facts.hiddenTabHrefs.includes(href));
}

export function AdminTabs({ facts }: { facts: AdminTabFacts }) {
  const pathname = usePathname();
  const tabs = readAdminTabs(readConsoleKey(pathname), facts);
  if (tabs.length === 0) return null;
  return (
    <nav aria-label="Pages in this part of the console" data-print="hide" className="fh-chips mb-5">
      {tabs.map(({ label, href, readBadge, badgeDescription }) => {
        const count = readBadge?.(facts) ?? 0;
        return (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={CHIP_CLASSES}>
            {label}
            {count ? (
              <span role="img" aria-label={badgeDescription?.(count) ?? `${count} need your attention`} className="fh-n">
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
