import { z } from "zod";

import { ASK_CATEGORIES, type AskCategory } from "./contract.ts";

const VIEW_PARAM = "view";
const CATEGORY_PARAM = "category";

export const ASK_VIEWS = { board: "board", yours: "yours" } as const;

export type AskView = (typeof ASK_VIEWS)[keyof typeof ASK_VIEWS];
export type AskBoardFilters = { view: AskView; category: AskCategory | null };

type SearchParamValue = string | string[] | undefined;

const viewSchema = z.enum(ASK_VIEWS).catch(ASK_VIEWS.board);
const categorySchema = z.enum(ASK_CATEGORIES).nullable().catch(null);

function readFirstValue(value: SearchParamValue) {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export function parseAskBoardFilters(params: Record<string, SearchParamValue>): AskBoardFilters {
  return {
    view: viewSchema.parse(readFirstValue(params[VIEW_PARAM])),
    category: categorySchema.parse(readFirstValue(params[CATEGORY_PARAM])),
  };
}

export function toAskBoardQueryString({ view, category }: AskBoardFilters) {
  const params = new URLSearchParams();
  if (view !== ASK_VIEWS.board) params.set(VIEW_PARAM, view);
  if (category) params.set(CATEGORY_PARAM, category);
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}
