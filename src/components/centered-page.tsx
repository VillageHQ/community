import type { ReactNode } from "react";

import { LogoTile } from "@/components/logo-tile";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { SiteFooter } from "@/components/source-code-link";
import type { CommunityLogo } from "@/platform/branding/branding";

type CenteredPageProps = { name: string; logo: CommunityLogo | null; children: ReactNode };

export function CenteredPage({ name, logo, children }: CenteredPageProps) {
  return (
    <main data-slot="centered-page" id={MAIN_CONTENT_ID} tabIndex={-1} className="flex min-h-dvh flex-col items-center justify-center gap-6 px-3.5 py-10">
      <div className="type-serif flex items-center gap-3 text-xl">
        <LogoTile name={name} logo={logo} />
        {name}
      </div>
      <div className="w-full max-w-[640px] rounded-panel bg-card shadow-panel">{children}</div>
      <SiteFooter name={name} />
    </main>
  );
}
