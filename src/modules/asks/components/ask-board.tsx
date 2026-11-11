"use client";

import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { HandHelping, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ASK_BOARD_TABS, ASK_KINDS, type AskBoardTab, type AskCategory, type AskKind } from "@/modules/asks/contract";
import { askBoardQuery } from "@/modules/asks/queries";

import { AskCard } from "./ask-card";
import { CATEGORY_DISPLAY } from "./ask-display";

type EmptyBoardProps = {
  tab?: AskBoardTab;
  search?: string | null;
  category: AskCategory | null;
  kind?: AskKind | null;
  onAsk: () => void;
  onSeeEverything: () => void;
};

function EmptyPanel({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="rounded-panel bg-card shadow-panel">
      <EmptyState icon={HandHelping} title={title} description={description}>
        {children}
      </EmptyState>
    </div>
  );
}

function EmptyBoard({ tab = ASK_BOARD_TABS.open, search = null, category, kind = null, onAsk, onSeeEverything }: EmptyBoardProps) {
  const askButton = (
    <Button type="button" size="lg" onClick={onAsk}>
      <Plus aria-hidden="true" />
      Ask for something
    </Button>
  );
  const seeOpenButton = (
    <Button type="button" size="lg" variant="quiet" onClick={onSeeEverything}>
      See every open ask
    </Button>
  );
  if (search) {
    return (
      <div className="rounded-panel bg-card shadow-panel">
        <EmptyState icon={Search} title={`Nothing matches "${search}"`} description="We looked in every ask, closed ones too, and in their answers. Try fewer or other words, or ask for it.">
          {askButton}
        </EmptyState>
      </div>
    );
  }
  if (tab === ASK_BOARD_TABS.answered) {
    return (
      <EmptyPanel title="No answered asks yet" description="When a member who has done it answers an ask, it shows here, open or closed.">
        {seeOpenButton}
      </EmptyPanel>
    );
  }
  if (tab === ASK_BOARD_TABS.closed) {
    return (
      <EmptyPanel title="No closed asks yet" description="When a member closes an ask, it moves here, with how it ended.">
        {seeOpenButton}
      </EmptyPanel>
    );
  }
  if (kind === ASK_KINDS.update && !category) {
    return (
      <EmptyPanel title="No updates yet" description="When something works out, a hire, a customer, a round, share it here so the people who helped can see it.">
        <Button type="button" size="lg" onClick={onAsk}>
          <Plus aria-hidden="true" />
          Share an update
        </Button>
        {seeOpenButton}
      </EmptyPanel>
    );
  }
  return (
    <EmptyPanel
      title={category ? `No open asks in ${CATEGORY_DISPLAY[category].filterLabel} right now` : "Be the first to ask"}
      description={
        category
          ? "That could change with yours. Say what you need, and someone here may step in."
          : "Say what you need, like a fractional CFO who's done a Series A. Members who can help will step in."
      }
    >
      {askButton}
      {category ? seeOpenButton : null}
    </EmptyPanel>
  );
}

type AskBoardProps = EmptyBoardProps & { tab: AskBoardTab; search: string | null; isViewerAdmin: boolean; onSeeYourAsks: () => void };

function describeResults(search: string, count: number, hasMore: boolean) {
  if (hasMore) return `More than ${count} asks match "${search}", newest first, closed ones too.`;
  return count === 1 ? `1 ask matches "${search}", closed ones too.` : `${count} asks match "${search}", newest first, closed ones too.`;
}

export function AskBoard({ tab, search, category, kind = null, isViewerAdmin, onAsk, onSeeEverything, onSeeYourAsks }: AskBoardProps) {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(askBoardQuery({ tab, search, category, kind }));
  const asks = data.pages.flatMap((page) => page.asks);
  const pinnedAsks = data.pages[0]?.pinnedAsks ?? [];
  const canIntro = data.pages[0]?.canIntro ?? false;
  if (asks.length === 0 && pinnedAsks.length === 0) {
    return <EmptyBoard tab={tab} search={search} category={category} kind={kind} onAsk={onAsk} onSeeEverything={onSeeEverything} />;
  }
  return (
    <div className="grid gap-4">
      {search ? (
        <p role="status" className="type-small font-semibold text-foreground-soft">
          {describeResults(search, asks.length, hasNextPage)}
        </p>
      ) : null}
      {pinnedAsks.length > 0 ? (
        <ul aria-label="Pinned by an admin" className="grid items-start gap-4 xl:grid-cols-2">
          {pinnedAsks.map((ask) => (
            <li key={ask.id}>
              <AskCard ask={ask} canIntro={canIntro} isViewerAdmin={isViewerAdmin} onSeeYourAsks={onSeeYourAsks} />
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="grid items-start gap-4 xl:grid-cols-2">
        {asks.map((ask) => (
          <li key={ask.id}>
            <AskCard ask={ask} canIntro={canIntro} isViewerAdmin={isViewerAdmin} onSeeYourAsks={onSeeYourAsks} />
          </li>
        ))}
      </ul>
      {hasNextPage ? (
        <Button type="button" size="lg" variant="outline" disabled={isFetchingNextPage} className="justify-self-center" onClick={() => void fetchNextPage()}>
          {isFetchingNextPage ? "Finding more…" : "Show more asks"}
        </Button>
      ) : null}
    </div>
  );
}
