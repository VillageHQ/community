import type { ReactNode } from "react";

export function ExternalTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-bold text-brand-emphasis underline underline-offset-3 hover:no-underline">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
