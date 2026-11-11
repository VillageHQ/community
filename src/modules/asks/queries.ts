import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { acknowledgedResponseSchema } from "../../platform/http/contract.ts";
import { INBOX_POLL_MS, isRouteGone, readInboxPollMs } from "../../platform/http/polling.ts";
import { postRequest } from "../../platform/http/post-request.ts";
import {
  ASK_API_ROUTES,
  ASK_STATUS_ACTIONS,
  allowanceSettingSchema,
  askBoardPageSchema,
  askCountsSchema,
  createdAnswerSchema,
  createdAskSchema,
  createdIntroSchema,
  offerResultSchema,
  ownAsksSchema,
  type AnswerAskBody,
  type AskCategory,
  type AskCursor,
  type AskDraft,
  type AskBoardTab,
  type AskHelperBody,
  type AskKind,
  type CloseAskBody,
  type KnowSomeoneDraft,
  type OfferHelpBody,
  type PinAskBody,
} from "./contract.ts";

export const ASK_QUERY_KEYS = {
  board: "asks-board",
  own: "asks-own",
  counts: "asks-counts",
} as const;

const FIRST_PAGE: AskCursor | null = null;

export type AskBoardRequest = { tab: AskBoardTab; search: string | null; category: AskCategory | null; kind: AskKind | null };

export function askBoardQuery({ tab, search, category, kind }: AskBoardRequest) {
  return infiniteQueryOptions({
    queryKey: [ASK_QUERY_KEYS.board, tab, search, category, kind],
    queryFn: ({ pageParam }) => postRequest(ASK_API_ROUTES.board, { tab, search, category, kind, cursor: pageParam }, askBoardPageSchema),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: ({ nextCursor }) => nextCursor,
    staleTime: INBOX_POLL_MS,
  });
}

export function ownAsksQuery() {
  return queryOptions({
    queryKey: [ASK_QUERY_KEYS.own],
    queryFn: () => postRequest(ASK_API_ROUTES.own, {}, ownAsksSchema),
    staleTime: INBOX_POLL_MS,
  });
}

export function askCountsQuery() {
  return queryOptions({
    queryKey: [ASK_QUERY_KEYS.counts],
    queryFn: () => postRequest(ASK_API_ROUTES.counts, {}, askCountsSchema),
    staleTime: INBOX_POLL_MS,
    refetchInterval: ({ state }) => (isRouteGone(state.error) ? false : readInboxPollMs(state.status === "error")),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function createAskRequest(body: AskDraft) {
  return postRequest(ASK_API_ROUTES.create, body, createdAskSchema);
}

export function offerHelpRequest(body: OfferHelpBody) {
  return postRequest(ASK_API_ROUTES.offer, body, offerResultSchema);
}

export function closeAskRequest(body: CloseAskBody) {
  return postRequest(ASK_API_ROUTES.close, body, acknowledgedResponseSchema);
}

export function renewAskRequest(askId: string) {
  return postRequest(ASK_API_ROUTES.renew, { askId }, acknowledgedResponseSchema);
}

export function markOffersSeenRequest() {
  return postRequest(ASK_API_ROUTES.seen, {}, acknowledgedResponseSchema);
}

export function reportAskRequest(askId: string) {
  return postRequest(ASK_API_ROUTES.report, { askId }, acknowledgedResponseSchema);
}

export function removeAskRequest(askId: string) {
  return postRequest(ASK_API_ROUTES.remove, { askId }, acknowledgedResponseSchema);
}

export function answerAskRequest(body: AnswerAskBody) {
  return postRequest(ASK_API_ROUTES.answer, body, createdAnswerSchema);
}

export function reportAnswerRequest(answerId: string) {
  return postRequest(ASK_API_ROUTES.reportAnswer, { answerId }, acknowledgedResponseSchema);
}

export function knowSomeoneRequest(body: KnowSomeoneDraft) {
  return postRequest(ASK_API_ROUTES.knowSomeone, body, createdIntroSchema);
}

export function askHelperRequest(body: AskHelperBody) {
  return postRequest(ASK_API_ROUTES.askHelper, body, createdIntroSchema);
}

export function saveAllowanceRequest(weeklyAllowance: number) {
  return postRequest(ASK_API_ROUTES.allowance, { weeklyAllowance }, allowanceSettingSchema);
}

export function pinAskRequest(body: PinAskBody) {
  return postRequest(ASK_API_ROUTES.pin, body, acknowledgedResponseSchema);
}

// Asks & digest › Close: an admin ends an ask for everyone (the ask page's status route).
export function closeAskAsAdminRequest(askId: string) {
  return postRequest(ASK_API_ROUTES.status, { askId, action: ASK_STATUS_ACTIONS.close }, acknowledgedResponseSchema);
}

export function reopenAskRequest(askId: string) {
  return postRequest(ASK_API_ROUTES.reopen, { askId }, acknowledgedResponseSchema);
}
