"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CHIP_CLASSES } from "@/components/ui/chip";
import { CONSOLE_KEYS, readConsoleKey } from "@/shell/navigation-rules";
import type { AdminTabFacts } from "@/shell/admin-badges";
import { ROUTES } from "@/platform/http/routes";
import { CHAT_ADMIN_PAGE } from "@/modules/chat/contract";
import { PERKS_ADMIN_PAGE } from "@/modules/perks/contract";
import { ASKS_ADMIN_PAGE } from "@/modules/asks/contract";

// The console's own menu is the sidebar (and the phone tabs). Community has pages Founderhall's menu has no item for;
// each lights a console item and is listed here, as a row of chips under the page title, beside the pages of the
// same item. The areas replace these rows with Founderhall's Set up list and Asks & digest page.
type AdminTab = { label: string; href: string; readBadge?: (facts: AdminTabFacts) => number; badgeDescription?: (count: number) => string };

const SETUP_TAB: AdminTab = {
  label: "Setup checklist",
  href: ROUTES.adminSetup,
  readBadge: ({ setupStepsLeft }) => setupStepsLeft,
  badgeDescription: (count) => `${count} setup ${count === 1 ? "step" : "steps"} left`,
};

const SET_UP_TABS: AdminTab[] = [
  { label: "Settings", href: ROUTES.adminSettings },
  { label: "Email", href: ROUTES.adminEmail },
  { label: "Village check", href: ROUTES.adminVillage },
  {
    label: "Credits",
    href: ROUTES.adminCredits,
    readBadge: ({ creditsBadge }) => creditsBadge,
    badgeDescription: () => "Out of Village credits",
  },
  {
    label: "Slack and Discord",
    href: CHAT_ADMIN_PAGE,
    readBadge: ({ chatBadge }) => chatBadge,
    badgeDescription: () => "A connection needs a look",
  },
  { label: "Perks", href: PERKS_ADMIN_PAGE },
  { label: "Features", href: ROUTES.adminFeatures },
  {
    label: "Reports",
    href: ROUTES.adminReports,
    readBadge: ({ reportsBadge }) => reportsBadge,
    badgeDescription: (count) => `${count} open ${count === 1 ? "report" : "reports"}`,
  },
  { label: "Audit log", href: ROUTES.adminAuditLog },
];

const TABS_BY_ITEM: Partial<Record<string, AdminTab[]>> = {
  [CONSOLE_KEYS.setup]: SET_UP_TABS,
  [CONSOLE_KEYS.asks]: [
    { label: "Asks", href: ASKS_ADMIN_PAGE },
    { label: "Weekly email", href: ROUTES.adminWeeklyEmail },
  ],
};

// Pages whose module is off are hidden (their href is in hiddenTabHrefs).
export function readAdminTabs(consoleKey: string, facts: AdminTabFacts) {
  const tabs = TABS_BY_ITEM[consoleKey] ?? [];
  const withSetup = consoleKey === CONSOLE_KEYS.setup && !facts.isSetupComplete ? [SETUP_TAB, ...tabs] : tabs;
  return withSetup.filter(({ href }) => !facts.hiddenTabHrefs.includes(href));
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
