"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavigationBadge } from "@/components/shell/navigation-links";
import { CHIP_CLASSES } from "@/components/ui/chip";
import { ROUTES } from "@/lib/routes";

const ADMIN_TABS = [
  { label: "Setup", href: ROUTES.admin },
  { label: "Members", href: ROUTES.adminMembers },
];

export function AdminTabs({ membersBadgeCount = 0 }: { membersBadgeCount?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="mb-5 flex flex-wrap gap-2 lg:mb-6">
      {ADMIN_TABS.map(({ label, href }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={CHIP_CLASSES}>
          {label}
          {href === ROUTES.adminMembers ? <NavigationBadge count={membersBadgeCount} /> : null}
        </Link>
      ))}
    </nav>
  );
}
