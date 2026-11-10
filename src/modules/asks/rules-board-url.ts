import { z } from "zod";

import { ASK_CATEGORIES, ASK_KINDS, type AskCategory, type AskKind } from "./contract.ts";

const VIEW_PARAM = "view";
const CATEGORY_PARAM = "category";
const KIND_PARAM = "kind";

export const ASK_VIEWS = { board: "board", yours: "yours" } as const;

export type AskView = (typeof ASK_VIEWS)[keyof typeof ASK_VIEWS];
export type AskBoardFilters = { view: AskView; category: AskCategory | null; kind: AskKind | null };

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
  };
}

export function toAskBoardQueryString({ view, category, kind }: AskBoardFilters) {
  const params = new URLSearchParams();
  if (view !== ASK_VIEWS.board) params.set(VIEW_PARAM, view);
  if (category) params.set(CATEGORY_PARAM, category);
  if (kind) params.set(KIND_PARAM, kind);
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}
