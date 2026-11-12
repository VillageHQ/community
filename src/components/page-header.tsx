import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  // The page's actions, in a row under the line ("Ask for an intro", "Post an ask").
  action?: ReactNode;
  // The small Graphite line above the title ("11 Nov · Sam's week at Northwind Founders").
  eyebrow?: ReactNode;
  // A back link above the title on detail pages ("‹ Your intros").
  back?: { href: string; label: string };
};

// Founderhall's page head (crop pagehead-today.png): small line, serif H1 (28/34 → 34/42), the lede (Graphite,
// max 62ch), then the actions 14 px below.
export function PageHeader({ title, description, action, eyebrow, back }: PageHeaderProps) {
  return (
    <header data-slot="page-header" className="fh-pagehead">
      {back ? <BackLink href={back.href}>{back.label}</BackLink> : null}
      {eyebrow ? <p className="fh-small fh-muted">{eyebrow}</p> : null}
      {/* Founderhall puts the title 6 px under the small line (asks/views.mjs, the Today head). */}
      <h1 className="fh-h1" style={eyebrow ? { marginTop: 6 } : undefined}>
        {title}
      </h1>
      {description ? <p className="fh-lede">{description}</p> : null}
      {action ? <div className="fh-btn-row mt-3.5">{action}</div> : null}
    </header>
  );
}

// Founderhall's back link (crop button-quiet-back.png): 500 Graphite, Vellum on hover.
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="fh-back">
      <ChevronLeft aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
      {children}
    </Link>
  );
}

// A section's head row: the title left and one link right (`.section-head`).
export function SectionHead({ title, link, headingLevel: Heading = "h2" }: { title: ReactNode; link?: ReactNode; headingLevel?: "h2" | "h3" }) {
  return (
    <div className="fh-section-head">
      <Heading className="fh-h2">{title}</Heading>
      {link}
    </div>
  );
}
