import { cn } from "cn";
import type { ElementType, ReactNode } from "react";

import { FundMark } from "@/components/logo-tile";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { SiteFooter } from "@/components/source-code-link";
import type { CommunityLogo } from "@/platform/branding/branding";

type PublicPageProps = {
  community: { name: string; logo: CommunityLogo | null };
  // The sign-in page carries the product credit; pages reached from emails carry only the source link.
  withCredit?: boolean;
  // Where the community is hosted, after the credit ("Northwind Founders, EU (Frankfurt)").
  hosting?: string;
  // 760 px instead of 460 (the public job board).
  isWide?: boolean;
  // A page inside the app (onboarding) hides the app's menus while it shows.
  isTakeover?: boolean;
  copyAs?: ElementType;
  // Shown between the fund's mark and the card.
  lead?: ReactNode;
  slot?: string;
  children: ReactNode;
};

// Founderhall's public page (publicPage(), crop public-page-card.png): no menus; a 460 px column with the fund's mark
// (44 px tile + name 20/600) on top, one Leaf card (padding 24/20), and a 12 px footer. Desktop top padding 72.
export function PublicPage({ community, withCredit = false, hosting, isWide = false, isTakeover = false, copyAs: Copy = "main", lead, slot = "public-page", children }: PublicPageProps) {
  return (
    <div data-slot={slot} data-takeover={isTakeover ? "" : undefined} className="fh-public">
      <Copy {...(Copy === "main" ? { id: MAIN_CONTENT_ID, tabIndex: -1 } : {})} className={cn("fh-pub outline-none", isWide && "max-w-[760px]")}>
        <FundMark name={community.name} logo={community.logo} size="public" />
        {lead}
        <section className="fh-sheet fh-pub-card">{children}</section>
        <SiteFooter withCredit={withCredit} hosting={hosting} />
      </Copy>
    </div>
  );
}

type PublicMessageProps = {
  community: { name: string; logo: CommunityLogo | null };
  title: ReactNode;
  children?: ReactNode;
  // Founderhall's messagePage ends with one secondary button; badLinkPage with one primary.
  action?: ReactNode;
};

// Founderhall's messagePage (views-public.mjs): a public card with a heading, a lede and one button row. Used by the
// Community-only public pages (sign-up closed, unsubscribe, the weekly answer…) so they read like Founderhall's.
export function PublicMessage({ community, title, children, action }: PublicMessageProps) {
  return (
    <PublicPage community={community}>
      <h1 className="fh-h2">{title}</h1>
      {children ? <div className="fh-lede">{children}</div> : null}
      {action ? <div className="fh-btn-row mt-4">{action}</div> : null}
    </PublicPage>
  );
}
