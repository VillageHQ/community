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
import { ASKS_PAGE, type AskCategory } from "@/modules/asks/contract";
import { askCountsQuery } from "@/modules/asks/queries";
import { ASK_VIEWS, parseAskBoardFilters, parseAskDraft, toAskBoardQueryString, type AskBoardFilters, type AskView } from "@/modules/asks/rules-board-url";

import { AskBoard } from "./ask-board";
import { AskComposer } from "./ask-composer";
import { CATEGORIES, CATEGORY_DISPLAY } from "./ask-display";
import { YourAsks } from "./your-asks";

const POSTED_MESSAGE = "Your ask is on the board. We'll count offers in the Asks badge.";

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

type CategoryChipsProps = { category: AskCategory | null; onChange: (category: AskCategory | null) => void };

function CategoryChips({ category, onChange }: CategoryChipsProps) {
  return (
    <div role="group" aria-label="Filter by kind of help" className="flex gap-2 max-sm:-mx-3.5 max-sm:overflow-x-auto max-sm:px-3.5 max-sm:pb-1 sm:flex-wrap">
      <Chip isPressed={category === null} onClick={() => onChange(null)}>
        All
      </Chip>
      {CATEGORIES.map((choice) => (
        <Chip key={choice} isPressed={category === choice} onClick={() => onChange(choice)}>
          {CATEGORY_DISPLAY[choice].filterLabel}
        </Chip>
      ))}
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
  const seeYourAsks = () => applyFilters({ view: ASK_VIEWS.yours, category: null });

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
        <ViewChips view={filters.view} onChange={(view) => applyFilters({ view, category: null })} />
        {filters.view === ASK_VIEWS.board ? <CategoryChips category={filters.category} onChange={(category) => applyFilters({ view: ASK_VIEWS.board, category })} /> : null}
        <QueryBoundary loadingMessage="Finding asks…">
          {deferredFilters.view === ASK_VIEWS.board ? (
            <AskBoard
              category={deferredFilters.category}
              isViewerAdmin={isViewerAdmin}
              onAsk={openComposer}
              onSeeEverything={() => applyFilters({ view: ASK_VIEWS.board, category: null })}
              onSeeYourAsks={seeYourAsks}
            />
          ) : (
            <YourAsks onAsk={openComposer} />
          )}
        </QueryBoundary>
      </div>
      <AskComposer
        isOpen={isComposerOpen}
        onOpenChange={setIsComposerOpen}
        draftTitle={draftTitle ?? ""}
        onSeeYourAsks={seeYourAsks}
        onPosted={() => {
          setIsComposerOpen(false);
          setDraftTitle(null);
          setNotice(POSTED_MESSAGE);
          applyFilters({ view: ASK_VIEWS.board, category: null });
        }}
      />
    </>
  );
}
