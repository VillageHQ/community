import type { ReactNode } from "react";

import { PublicPage } from "@/components/public-page";
import type { CommunityLogo } from "@/platform/branding/branding";

type CenteredPageProps = { name: string; logo: CommunityLogo | null; children: ReactNode };

// A page with no menus (a page that isn't there): Founderhall's public page.
export function CenteredPage({ name, logo, children }: CenteredPageProps) {
  return (
    <PublicPage community={{ name, logo }} slot="centered-page">
      {children}
    </PublicPage>
  );
}
