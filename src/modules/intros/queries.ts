import { queryOptions } from "@tanstack/react-query";

import { readInboxPollMs, INBOX_POLL_MS } from "../../platform/http/polling.ts";
import { API_ROUTES } from "../../platform/http/routes.ts";
import { acknowledgedResponseSchema } from "../../platform/http/contract.ts";
import { postNetworkRequest } from "../../platform/http/post-request.ts";
import { introBoardSchema, introCountsSchema, introSchema, type CreateIntroBody, type IntroTransitionBody } from "./contract.ts";

export const INTRO_QUERY_KEYS = {
  board: "intros-board",
  counts: "intros-counts",
  detail: "intros-detail",
} as const;

export function introBoardQuery() {
  return queryOptions({
    queryKey: [INTRO_QUERY_KEYS.board],
    queryFn: () => postNetworkRequest(API_ROUTES.intros, {}, introBoardSchema),
    staleTime: INBOX_POLL_MS,
    refetchInterval: ({ state }) => readInboxPollMs(state.status === "error"),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function introCountsQuery() {
  return queryOptions({
    queryKey: [INTRO_QUERY_KEYS.counts],
    queryFn: () => postNetworkRequest(API_ROUTES.introCounts, {}, introCountsSchema),
    staleTime: INBOX_POLL_MS,
    refetchInterval: ({ state }) => readInboxPollMs(state.status === "error"),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function introDetailQuery(introId: string) {
  return queryOptions({
    queryKey: [INTRO_QUERY_KEYS.detail, introId],
    queryFn: () => postNetworkRequest(API_ROUTES.introDetail, { introId }, introSchema),
    staleTime: INBOX_POLL_MS,
    refetchInterval: ({ state }) => readInboxPollMs(state.status === "error"),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function createIntroRequest(body: CreateIntroBody) {
  return postNetworkRequest(API_ROUTES.introCreate, body, introSchema);
}

export function transitionIntroRequest(body: IntroTransitionBody) {
  return postNetworkRequest(API_ROUTES.introTransition, body, introSchema);
}

export function markIntrosSeenRequest(introId: string | null) {
  return postNetworkRequest(API_ROUTES.introSeen, { introId }, acknowledgedResponseSchema);
}

export function reportIntroNoteRequest(introId: string) {
  return postNetworkRequest(API_ROUTES.introReport, { introId }, acknowledgedResponseSchema);
}
