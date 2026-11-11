import type { ElementType, ReactNode } from "react";

import type { ConstellationPerson } from "@/components/constellation";
import { LogoTile } from "@/components/logo-tile";
import { PublicPage } from "@/components/public-page";
import { OnlyOnVillage, VillageMark } from "@/components/village-mark";
import type { CommunityLogo } from "@/platform/branding/branding";

type Community = { name: string; descriptor: string; logo: CommunityLogo | null };

type SplitLayoutProps = {
  community: Community;
  you?: ConstellationPerson;
  people?: ConstellationPerson[];
  // The brand panel's note. Founderhall's public page has no brand panel, so it waits for the areas to place it.
  note?: ReactNode;
  copyAs?: ElementType;
  isTakeover?: boolean;
  withCredit?: boolean;
  hosting?: string;
  // Show the note above the card (onboarding: who invited you). Other pages' notes wait for their areas.
  isNoteShown?: boolean;
  children: ReactNode;
};

// Every signed-out page now uses Founderhall's public page (one card under the fund's mark). The name stays so the
// pages keep working until their areas rebuild them.
export function SplitLayout({ community, note, copyAs, isTakeover = false, withCredit = false, hosting, isNoteShown = false, children }: SplitLayoutProps) {
  return (
    <PublicPage
      community={community}
      copyAs={copyAs}
      isTakeover={isTakeover}
      withCredit={withCredit}
      hosting={hosting}
      lead={isNoteShown && note ? <figure className="m-0 mb-4 rounded-card border border-rule bg-leaf px-5 py-4">{note}</figure> : null}
      slot="split-layout"
    >
      {children}
    </PublicPage>
  );
}

export function CommunityNote({ community, children }: { community: Community; children: ReactNode }) {
  return (
    <>
      <p className="type-lead">{children}</p>
      <figcaption className="mt-3.5 flex items-center gap-3">
        <LogoTile name={community.name} logo={community.logo} sizePx={44} />
        <div className="min-w-0">
          <div className="type-label">{community.name}</div>
          {community.descriptor ? <div className="type-micro font-medium text-muted-foreground">{community.descriptor}</div> : null}
        </div>
      </figcaption>
    </>
  );
}

export function VillageNote() {
  return (
    <OnlyOnVillage otherwise={<p className="type-lead">A private community for your members.</p>}>
      <p className="type-lead">A private community, with its members&apos; networks a search away.</p>
      <figcaption className="mt-3.5 flex items-center gap-3">
        <VillageMark sizePx={44} />
        <div className="type-label">Network by Village</div>
      </figcaption>
    </OnlyOnVillage>
  );
}
