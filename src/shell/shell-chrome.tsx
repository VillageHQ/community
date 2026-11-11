"use client";

import { FundMark } from "@/components/logo-tile";
import { ProductCredit, SourceLine } from "@/components/source-code-link";
import type { CommunityLogo } from "@/platform/branding/branding";
import { ROUTES } from "@/platform/http/routes";

import Link from "next/link";

import { useFundMarkSub, useShellMode } from "./navigation-links";
import { CONSOLE_KEYS, MEMBER_KEYS, SHELL_MODES, type ShellNavigation } from "./navigation-rules";
import { SignOutButton } from "./user-menu";

type ShellFundMarkProps = { name: string; logo: CommunityLogo | null; isAdmin: boolean; size: "default" | "sidebar"; pathname?: string };

// The fund's mark in the sidebar and the phone top bar, with "Members", "Admin console" or "Founder view" under it.
export function ShellFundMark({ name, logo, isAdmin, size, pathname }: ShellFundMarkProps) {
  const sub = useFundMarkSub(isAdmin, pathname);
  const mode = useShellMode(isAdmin, pathname);
  return <FundMark name={name} logo={logo} sub={sub} size={size} href={mode === SHELL_MODES.console ? ROUTES.admin : ROUTES.feed} />;
}

// Member pages carry the source link; console pages carry the product credit.
export function ShellFooterLine({ isAdmin, pathname }: { isAdmin: boolean; pathname?: string }) {
  return useShellMode(isAdmin, pathname) === SHELL_MODES.console ? <ProductCredit /> : <SourceLine />;
}

// The menu items with no phone tab (Jobs and Perks; the Job board in the console). Founderhall reaches them from its
// pages; until the areas add those links, the phone foot lists them. The console's Home and Intro log link the
// Partner report, and Home and Members link Invites, so those two are left out.
const REACHED_FROM_CONSOLE_PAGES: readonly string[] = [CONSOLE_KEYS.report, CONSOLE_KEYS.invites];

function PhoneMoreLinks({ navigation, isAdmin, pathname }: { navigation: ShellNavigation; isAdmin: boolean; pathname?: string }) {
  const mode = useShellMode(isAdmin, pathname);
  const items = (mode === SHELL_MODES.console ? navigation.console : navigation.member).filter(
    (item) => !item.tabLabel && item.key !== MEMBER_KEYS.me && !REACHED_FROM_CONSOLE_PAGES.includes(item.key),
  );
  if (items.length === 0) return null;
  return (
    <nav aria-label="More" className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) =>
        item.isFullPageLoad ? (
          <a key={item.key} href={item.href} className="fh-linkbtn">
            {item.label}
          </a>
        ) : (
          <Link key={item.key} href={item.href} className="fh-linkbtn">
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}

// The foot of every page on a phone (crop footer-phone.png): Sign out, then the footer line.
export function PhoneFoot({ isAdmin, pathname, navigation }: { isAdmin: boolean; pathname?: string; navigation?: ShellNavigation }) {
  return (
    <div data-slot="phone-foot" className="fh-phone-foot">
      {navigation ? <PhoneMoreLinks navigation={navigation} isAdmin={isAdmin} pathname={pathname} /> : null}
      <SignOutButton />
      <ShellFooterLine isAdmin={isAdmin} pathname={pathname} />
    </div>
  );
}
