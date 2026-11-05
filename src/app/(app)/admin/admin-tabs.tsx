"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavigationBadge } from "@/components/shell/navigation-links";
import { CHIP_CLASSES } from "@/components/ui/chip";
import type { AdminTabFacts } from "@/lib/admin/admin-badges";
import { ROUTES } from "@/lib/routes";

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
  { label: "Health", href: ROUTES.adminHealth, readBadge: () => 0, badgeDescription: () => "" },
  {
    label: "Credits",
    href: ROUTES.adminCredits,
    readBadge: ({ creditsBadge }) => creditsBadge,
    badgeDescription: () => "Out of Village credits",
  },
  { label: "Settings", href: ROUTES.adminSettings, readBadge: () => 0, badgeDescription: () => "" },
];

export function AdminTabs({ facts }: { facts: AdminTabFacts }) {
  const pathname = usePathname();
  const tabs = facts.isSetupComplete ? ADMIN_TABS : [SETUP_TAB, ...ADMIN_TABS];
  return (
    <nav aria-label="Admin sections" className="mb-5 flex flex-wrap gap-2 lg:mb-6">
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
