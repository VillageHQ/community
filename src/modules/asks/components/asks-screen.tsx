"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { QueryBoundary } from "@/components/query-boundary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Tag } from "@/components/ui/tag";
import { ASK_KINDS, ASKS_PAGE, type AskCategory, type AskKind } from "@/modules/asks/contract";
import { askCountsQuery } from "@/modules/asks/queries";
import { ASK_VIEWS, parseAskBoardFilters, parseAskDraft, toAskBoardQueryString, type AskBoardFilters, type AskView } from "@/modules/asks/rules-board-url";

import { AskBoard } from "./ask-board";
import { AskComposer } from "./ask-composer";
import { CATEGORIES, CATEGORY_DISPLAY } from "./ask-display";
import { YourAsks } from "./your-asks";

function describePosted(kind: AskKind, helperCount: number) {
  if (kind === ASK_KINDS.update) return "Your update is on the board.";
  if (helperCount === 0) return "Your ask is on the board. We'll count offers in the Asks badge.";
  const people = helperCount === 1 ? "1 member who may help" : `${helperCount} members who may help`;
  return `Your ask is on the board, and we let ${people} know. You'll see them under Your asks.`;
}

function applyFilters(filters: AskBoardFilters) {
  window.history.replaceState(null, "", `${ASKS_PAGE}${toAskBoardQueryString(filters)}`);
}

type ViewChipsProps = { view: AskView; onChange: (view: AskView) => void };

function ViewChips({ view, onChange }: ViewChipsProps) {
  const { data } = useQuery(askCountsQuery());
  const newOffers = data?.newOffers ?? 0;
  return (
    <div role="group" aria-label="Which asks to show" className="flex flex-wrap gap-2">
      <Chip isPressed={view === ASK_VIEWS.board} onClick={() => onChange(ASK_VIEWS.board)}>
        Open asks
      </Chip>
      <Chip isPressed={view === ASK_VIEWS.yours} onClick={() => onChange(ASK_VIEWS.yours)}>
        Your asks
        {newOffers > 0 ? <Tag tone="accent">{newOffers} new</Tag> : null}
      </Chip>
    </div>
  );
}

type BoardFilter = { category: AskCategory | null; kind: AskKind | null };
type CategoryChipsProps = BoardFilter & { onChange: (filter: BoardFilter) => void };

function CategoryChips({ category, kind, onChange }: CategoryChipsProps) {
  return (
    <div role="group" aria-label="Filter by kind of help" className="flex gap-2 max-sm:-mx-3.5 max-sm:overflow-x-auto max-sm:px-3.5 max-sm:pb-1 sm:flex-wrap">
      <Chip isPressed={category === null && kind === null} onClick={() => onChange({ category: null, kind: null })}>
        All
      </Chip>
      {CATEGORIES.map((choice) => (
        <Chip key={choice} isPressed={category === choice} onClick={() => onChange({ category: choice, kind: ASK_KINDS.ask })}>
          {CATEGORY_DISPLAY[choice].filterLabel}
        </Chip>
      ))}
      <Chip isPressed={kind === ASK_KINDS.update} onClick={() => onChange({ category: null, kind: ASK_KINDS.update })}>
        Updates
      </Chip>
    </div>
  );
}

export function AsksScreen({ isViewerAdmin }: { isViewerAdmin: boolean }) {
  const searchParams = Object.fromEntries(useSearchParams());
  const filters = parseAskBoardFilters(searchParams);
  const deferredFilters = useDeferredValue(filters);
  const [draftTitle, setDraftTitle] = useState(() => parseAskDraft(searchParams));
  const [isComposerOpen, setIsComposerOpen] = useState(draftTitle !== null);
  const [notice, setNotice] = useState<string | null>(null);
  const openComposer = () => setIsComposerOpen(true);
  const seeYourAsks = () => applyFilters({ view: ASK_VIEWS.yours, category: null, kind: null });
  const seeEverything = () => applyFilters({ view: ASK_VIEWS.board, category: null, kind: null });

  return (
    <>
      <PageHeader
        title="Asks"
        description="Say what you need. Someone here may be able to help."
        action={
          <Button type="button" size="lg" onClick={openComposer} className="max-sm:w-full">
            <Plus aria-hidden="true" />
            Ask for something
          </Button>
        }
      />
      <div className="grid gap-4">
        <div aria-live="polite" className="empty:hidden">
          {notice ? (
            <Alert variant="success" role="none">
              {notice}
            </Alert>
          ) : null}
        </div>
        <ViewChips view={filters.view} onChange={(view) => applyFilters({ view, category: null, kind: null })} />
        {filters.view === ASK_VIEWS.board ? (
          <CategoryChips category={filters.category} kind={filters.kind} onChange={(filter) => applyFilters({ view: ASK_VIEWS.board, ...filter })} />
        ) : null}
        <QueryBoundary loadingMessage="Finding asks…">
          {deferredFilters.view === ASK_VIEWS.board ? (
            <AskBoard
              category={deferredFilters.category}
              kind={deferredFilters.kind}
              isViewerAdmin={isViewerAdmin}
              onAsk={openComposer}
              onSeeEverything={seeEverything}
              onSeeYourAsks={seeYourAsks}
            />
          ) : (
            <YourAsks onAsk={openComposer} isViewerAdmin={isViewerAdmin} />
          )}
        </QueryBoundary>
      </div>
      <AskComposer
        isOpen={isComposerOpen}
        onOpenChange={setIsComposerOpen}
        draftTitle={draftTitle ?? ""}
        onSeeYourAsks={seeYourAsks}
        onPosted={(kind, helperCount) => {
          setIsComposerOpen(false);
          setDraftTitle(null);
          setNotice(describePosted(kind, helperCount));
          seeEverything();
        }}
      />
    </>
  );
}
