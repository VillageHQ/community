"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { QueryBoundary } from "@/components/query-boundary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import { ASK_KINDS, ASK_LIMITS, ASKS_PAGE, type AskCategory, type AskKind } from "@/modules/asks/contract";
import { askCountsQuery } from "@/modules/asks/queries";
import { ASK_VIEWS, parseAskBoardFilters, parseAskDraft, readBoardTab, toAskBoardQueryString, type AskBoardFilters, type AskView } from "@/modules/asks/rules-board-url";

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

type ViewChipsProps = { view: AskView | null; onChange: (view: AskView) => void };

const VIEW_LABELS: { view: AskView; label: string }[] = [
  { view: ASK_VIEWS.board, label: "Open" },
  { view: ASK_VIEWS.yours, label: "Mine" },
  { view: ASK_VIEWS.answered, label: "Answered" },
  { view: ASK_VIEWS.closed, label: "Closed" },
];

function ViewChips({ view, onChange }: ViewChipsProps) {
  const { data } = useQuery(askCountsQuery());
  const newOffers = data?.newOffers ?? 0;
  return (
    <div role="group" aria-label="Which asks to show" className="flex flex-wrap gap-2">
      {VIEW_LABELS.map(({ view: choice, label }) => (
        <Chip key={choice} isPressed={view === choice} onClick={() => onChange(choice)}>
          {label}
          {choice === ASK_VIEWS.yours && newOffers > 0 ? <Tag tone="accent">{newOffers} new</Tag> : null}
        </Chip>
      ))}
    </div>
  );
}

const SEARCH_INPUT_ID = "asks-search";
const SEARCH_DELAY_MS = 300;

// One search over every ask, closed and expired ones too: the title, the details and the answers.
function AskSearch({ search, onSearch }: { search: string | null; onSearch: (search: string | null) => void }) {
  const [draft, setDraft] = useState(search ?? "");
  const [shownSearch, setShownSearch] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A tab or a new post clears the search from outside, so the box empties with it.
  if (search !== shownSearch) {
    setShownSearch(search);
    if (search === null) setDraft("");
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function schedule(value: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(value.replace(/\s+/g, " ").trim() || null), SEARCH_DELAY_MS);
  }

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        onSearch(draft.replace(/\s+/g, " ").trim() || null);
      }}
    >
      <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
        Search every ask, closed ones too
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-5 size-icon -translate-y-1/2 text-muted-foreground" />
      <Input
        id={SEARCH_INPUT_ID}
        type="search"
        value={draft}
        maxLength={ASK_LIMITS.searchLength}
        placeholder="Search every ask and answer"
        autoComplete="off"
        className="pr-14 pl-[54px] [&::-webkit-search-cancel-button]:hidden"
        onChange={(event) => {
          setDraft(event.target.value);
          schedule(event.target.value);
        }}
      />
      {draft ? (
        <Button
          type="button"
          variant="quiet"
          size="icon"
          aria-label="Clear search"
          className="absolute top-1.5 right-1.5"
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            setDraft("");
            onSearch(null);
          }}
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </form>
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
  const search = filters.search ?? null;
  const deferredTab = readBoardTab(deferredFilters);

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
        <AskSearch search={search} onSearch={(next) => applyFilters({ view: ASK_VIEWS.board, category: null, kind: null, search: next })} />
        <ViewChips
          view={search ? null : filters.view}
          onChange={(view) => applyFilters({ view, category: null, kind: null })}
        />
        {filters.view === ASK_VIEWS.board && !search ? (
          <CategoryChips category={filters.category} kind={filters.kind} onChange={(filter) => applyFilters({ view: ASK_VIEWS.board, ...filter })} />
        ) : null}
        <QueryBoundary loadingMessage="Finding asks…">
          {deferredTab ? (
            <AskBoard
              tab={deferredTab}
              search={deferredFilters.search ?? null}
              category={deferredFilters.search ? null : deferredFilters.category}
              kind={deferredFilters.search ? null : deferredFilters.kind}
              isViewerAdmin={isViewerAdmin}
              onAsk={openComposer}
              onSeeEverything={seeEverything}
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
