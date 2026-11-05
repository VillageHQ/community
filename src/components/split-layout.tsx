import type { ElementType, ReactNode } from "react";

import { Constellation, type ConstellationPerson } from "@/components/constellation";
import { LogoTile } from "@/components/logo-tile";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { NetworkByVillage, VillageMark } from "@/components/village-mark";
import type { CommunityLogo } from "@/platform/branding/branding";

type Community = { name: string; descriptor: string; logo: CommunityLogo | null };

type SplitLayoutProps = {
  community: Community;
  you?: ConstellationPerson;
  people?: ConstellationPerson[];
  note: ReactNode;
  copyAs?: ElementType;
  isTakeover?: boolean;
  children: ReactNode;
};

export function SplitLayout({
  community,
  you,
  people,
  note,
  copyAs: Copy = "main",
  isTakeover = false,
  children,
}: SplitLayoutProps) {
  return (
    <div
      data-slot="split-layout"
      data-takeover={isTakeover ? "" : undefined}
      className="grid min-h-dvh grid-cols-1 grid-rows-[auto_1fr] lg:grid-cols-[clamp(380px,39vw,500px)_minmax(0,1fr)] lg:grid-rows-1"
    >
      <aside
        aria-label={community.name}
        className="relative flex flex-col overflow-hidden rounded-b-card bg-primary p-card-phone text-primary-foreground lg:sticky lg:top-0 lg:h-dvh lg:min-h-[720px] lg:rounded-none lg:p-10"
      >
        <div className="flex items-center gap-3.5 text-[22px] leading-7 font-bold tracking-[-0.014em]">
          <LogoTile name={community.name} logo={community.logo} sizePx={52} tone="inverse" />
          <span className="min-w-0">{community.name}</span>
        </div>
        <div className="hidden min-h-0 flex-1 flex-col lg:flex">
          <Constellation you={you} people={people} />
          <figure className="relative rounded-card bg-card p-6 text-foreground shadow-[0_12px_32px_-14px_rgb(0_0_0/0.35)]">
            {note}
          </figure>
        </div>
      </aside>
      <Copy
        {...(Copy === "main" ? { id: MAIN_CONTENT_ID, tabIndex: -1 } : {})}
        className="flex min-w-0 flex-col px-3.5 pt-6 pb-10 sm:px-10 lg:min-h-dvh lg:px-16 lg:pt-11 lg:pb-12"
      >
        <div className="mx-auto w-full max-w-[720px] flex-1">{children}</div>
        <div className="mx-auto mt-8 w-full max-w-[720px] lg:hidden">
          <NetworkByVillage />
        </div>
      </Copy>
    </div>
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
    <>
      <p className="type-lead">A private community, with its members&apos; networks a search away.</p>
      <figcaption className="mt-3.5 flex items-center gap-3">
        <VillageMark sizePx={44} />
        <div className="type-label">Network by Village</div>
      </figcaption>
    </>
  );
}
