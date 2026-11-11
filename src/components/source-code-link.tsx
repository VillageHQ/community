import { cn } from "cn";

// The AGPL asks a network service to offer its source to the people who use it.
// A copy with changes should point NEXT_PUBLIC_SOURCE_CODE_URL at its own source.
export const SOURCE_CODE_URL =
  process.env.NEXT_PUBLIC_SOURCE_CODE_URL || "https://github.com/VillageHQ/community";

export const PRODUCT_CREDIT = "Founderhall by Village";

export function SourceCodeLink() {
  return (
    <a href={SOURCE_CODE_URL} target="_blank" rel="noopener noreferrer">
      Source code (AGPL-3.0)
    </a>
  );
}

// The product's mark beside its credit (14 px).
function ProductMark() {
  return (
    <svg viewBox="0 0 48 48" width="14" height="14" aria-hidden="true" className="shrink-0">
      <path d="M5 44 V24 A19 19 0 0 1 43 24 V44 H37 V24 A13 13 0 0 0 11 24 V44 Z" fill="var(--ink)" />
      <rect x="2" y="42" width="19" height="2.6" fill="var(--ink)" />
      <rect x="27" y="42" width="19" height="2.6" fill="var(--ink)" />
      <path d="M22 11 H26 V45 L24 42.3 L22 45 Z" fill="var(--ribbon)" />
    </svg>
  );
}

// Founderhall's footers (crops footer-credit-admin.png, footer-phone.png). Member pages carry only the source link
// the AGPL asks for; admin pages and the sign-in page carry the product credit. The community leads everywhere else.
export function SourceLine({ className }: { className?: string }) {
  return (
    <div data-slot="source-line" className={cn("fh-credit fh-plain", className)}>
      <SourceCodeLink />
    </div>
  );
}

export function ProductCredit({ className }: { className?: string }) {
  return (
    <div data-slot="product-credit" className={cn("fh-credit", className)}>
      <ProductMark />
      <span>
        {PRODUCT_CREDIT} ·{" "}
        <a href={SOURCE_CODE_URL} target="_blank" rel="noopener noreferrer">
          Open source, AGPL-3.0
        </a>
      </span>
    </div>
  );
}

// The 12 px line under a public page's card: the source link, or (sign-in) the product credit and where the
// community is hosted ("Hosted by Northwind Founders, EU (Frankfurt)").
type SiteFooterProps = { name?: string; withCredit?: boolean; hosting?: string; className?: string };

export function SiteFooter({ withCredit = false, hosting, className }: SiteFooterProps) {
  return (
    <p data-slot="site-footer" className={cn("fh-pub-foot", className)}>
      {withCredit ? (
        <>
          {PRODUCT_CREDIT} ·{" "}
          <a href={SOURCE_CODE_URL} target="_blank" rel="noopener noreferrer">
            Open source
          </a>
          {hosting ? ` · Hosted by ${hosting}` : null}
        </>
      ) : (
        <SourceCodeLink />
      )}
    </p>
  );
}
