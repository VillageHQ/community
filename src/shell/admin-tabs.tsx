"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavigationBadge } from "@/shell/navigation-links";
import { CHIP_CLASSES } from "@/components/ui/chip";
import type { AdminTabFacts } from "@/shell/admin-badges";
import { ROUTES } from "@/platform/http/routes";

type AdminTab = { label: string; href: string; readBadge: (facts: AdminTabFacts) => number; badgeDescription: (count: number) => string };

const SETUP_TAB: AdminTab = {
  label: "Setup",
  href: ROUTES.admin,
  readBadge: ({ setupStepsLeft }) => setupStepsLeft,
  badgeDescription: (count) => `${count} setup ${count === 1 ? "step" : "steps"} left`,
};

const ADMIN_TABS: AdminTab[] = [
  {
    label: "Members",
    href: ROUTES.adminMembers,
    readBadge: ({ membersBadge }) => membersBadge,
    badgeDescription: (count) => `${count} waiting for your approval`,
  },
  {
    label: "Reports",
    href: ROUTES.adminReports,
    readBadge: ({ reportsBadge }) => reportsBadge,
    badgeDescription: (count) => `${count} open ${count === 1 ? "report" : "reports"}`,
  },
  { label: "Audit log", href: ROUTES.adminAuditLog, readBadge: () => 0, badgeDescription: () => "" },
  { label: "Partner report", href: ROUTES.adminReport, readBadge: () => 0, badgeDescription: () => "" },
  {
    label: "Credits",
    href: ROUTES.adminCredits,
    readBadge: ({ creditsBadge }) => creditsBadge,
    badgeDescription: () => "Out of Village credits",
  },
  { label: "Features", href: ROUTES.adminFeatures, readBadge: () => 0, badgeDescription: () => "" },
  { label: "Settings", href: ROUTES.adminSettings, readBadge: () => 0, badgeDescription: () => "" },
];

export function AdminTabs({ facts }: { facts: AdminTabFacts }) {
  const pathname = usePathname();
  const visibleTabs = ADMIN_TABS.filter(({ href }) => !facts.hiddenTabHrefs.includes(href));
  const tabs = facts.isSetupComplete ? visibleTabs : [SETUP_TAB, ...visibleTabs];
  return (
    <nav aria-label="Admin sections" data-print="hide" className="mb-5 flex flex-wrap gap-2 lg:mb-6">
      {tabs.map(({ label, href, readBadge, badgeDescription }) => {
        const count = readBadge(facts);
        return (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={CHIP_CLASSES}>
            {label}
            <NavigationBadge count={count} description={badgeDescription(count)} />
          </Link>
        );
      })}
    </nav>
  );
}
