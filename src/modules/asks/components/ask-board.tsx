"use client";

import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { HandHelping, Plus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { AskCategory } from "@/modules/asks/contract";
import { askBoardQuery } from "@/modules/asks/queries";

import { AskCard } from "./ask-card";
import { CATEGORY_DISPLAY } from "./ask-display";

type EmptyBoardProps = { category: AskCategory | null; onAsk: () => void; onSeeEverything: () => void };

function EmptyBoard({ category, onAsk, onSeeEverything }: EmptyBoardProps) {
  return (
    <div className="rounded-panel bg-card shadow-panel">
      <EmptyState
        icon={HandHelping}
        title={category ? `No open asks in ${CATEGORY_DISPLAY[category].filterLabel} right now` : "Be the first to ask"}
        description={
          category
            ? "That could change with yours. Say what you need, and someone here may step in."
            : "Say what you need, like a fractional CFO who's done a Series A. Members who can help will step in."
        }
      >
        <Button type="button" size="lg" onClick={onAsk}>
          <Plus aria-hidden="true" />
          Ask for something
        </Button>
        {category ? (
          <Button type="button" size="lg" variant="quiet" onClick={onSeeEverything}>
            See every open ask
          </Button>
        ) : null}
      </EmptyState>
    </div>
  );
}

type AskBoardProps = EmptyBoardProps & { isViewerAdmin: boolean; onSeeYourAsks: () => void };

export function AskBoard({ category, isViewerAdmin, onAsk, onSeeEverything, onSeeYourAsks }: AskBoardProps) {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(askBoardQuery(category));
  const asks = data.pages.flatMap((page) => page.asks);
  if (asks.length === 0) return <EmptyBoard category={category} onAsk={onAsk} onSeeEverything={onSeeEverything} />;
  return (
    <div className="grid gap-4">
      <ul className="grid items-start gap-4 xl:grid-cols-2">
        {asks.map((ask) => (
          <li key={ask.id}>
            <AskCard ask={ask} isViewerAdmin={isViewerAdmin} onSeeYourAsks={onSeeYourAsks} />
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
