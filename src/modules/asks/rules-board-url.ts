import { z } from "zod";

import { ASK_BOARD_TABS, ASK_CATEGORIES, ASK_KINDS, ASK_LIMITS, type AskBoardTab, type AskCategory, type AskKind } from "./contract.ts";
import { ASK_DRAFT_PARAM } from "../../platform/modules/manifest.ts";

const VIEW_PARAM = "view";
const CATEGORY_PARAM = "category";
const KIND_PARAM = "kind";
const SEARCH_PARAM = "q";

// The tabs: Open is the board, Mine is "yours", Answered and Closed are board tabs too.
export const ASK_VIEWS = { board: "board", yours: "yours", answered: "answered", closed: "closed" } as const;

export type AskView = (typeof ASK_VIEWS)[keyof typeof ASK_VIEWS];
export type AskBoardFilters = { view: AskView; category: AskCategory | null; kind: AskKind | null; search?: string | null };

type SearchParamValue = string | string[] | undefined;

const viewSchema = z.enum(ASK_VIEWS).catch(ASK_VIEWS.board);
const categorySchema = z.enum(ASK_CATEGORIES).nullable().catch(null);
const kindSchema = z.enum(ASK_KINDS).nullable().catch(null);

function readFirstValue(value: SearchParamValue) {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export function parseAskBoardFilters(params: Record<string, SearchParamValue>): AskBoardFilters {
  return {
    view: viewSchema.parse(readFirstValue(params[VIEW_PARAM])),
    category: categorySchema.parse(readFirstValue(params[CATEGORY_PARAM])),
    kind: kindSchema.parse(readFirstValue(params[KIND_PARAM])),
    search: readFirstValue(params[SEARCH_PARAM])?.replace(/\s+/g, " ").trim().slice(0, ASK_LIMITS.searchLength) || null,
  };
}

const VIEW_TABS: Record<AskView, AskBoardTab | null> = {
  [ASK_VIEWS.board]: ASK_BOARD_TABS.open,
  [ASK_VIEWS.yours]: null,
  [ASK_VIEWS.answered]: ASK_BOARD_TABS.answered,
  [ASK_VIEWS.closed]: ASK_BOARD_TABS.closed,
};

// The board tab a view reads, or null for Your asks. A search always reads the board.
export function readBoardTab({ view, search }: AskBoardFilters): AskBoardTab | null {
  if (search) return ASK_BOARD_TABS.open;
  return VIEW_TABS[view];
}

export function toAskBoardQueryString({ view, category, kind, search = null }: AskBoardFilters) {
  const params = new URLSearchParams();
  if (search) params.set(SEARCH_PARAM, search);
  if (view !== ASK_VIEWS.board) params.set(VIEW_PARAM, view);
  if (category) params.set(CATEGORY_PARAM, category);
  if (kind) params.set(KIND_PARAM, kind);
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

// A prefilled ask from another screen, like an empty network search. Cut to fit the title.
export function parseAskDraft(params: Record<string, SearchParamValue>) {
  const draft = readFirstValue(params[ASK_DRAFT_PARAM])?.replace(/\s+/g, " ").trim() ?? "";
  return draft ? draft.slice(0, ASK_LIMITS.titleLength) : null;
}
