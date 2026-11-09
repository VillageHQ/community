import { queryOptions, skipToken } from "@tanstack/react-query";

import { readInboxPollMs, INBOX_POLL_MS, isRouteGone } from "../../platform/http/polling.ts";
import { API_ROUTES } from "../../platform/http/routes.ts";
import { acknowledgedResponseSchema } from "../../platform/http/contract.ts";
import { postRequest } from "../../platform/http/post-request.ts";
import {
  consentAnswerResponseSchema,
  introBoardSchema,
  introCountsSchema,
  introSchema,
  introWithConsentIssueSchema,
  type ConsentAnswerBody,
  type ConsentEmailBody,
  type ConsentIssue,
  type CreateIntroBody,
  type IntroOutcomeBody,
  type IntroTransitionBody,
} from "./contract.ts";

export const INTRO_QUERY_KEYS = {
  board: "intros-board",
  counts: "intros-counts",
  detail: "intros-detail",
} as const;

const ISSUED_CONSENT_QUERY_KEY = "intros-issued-consent";

export function introBoardQuery() {
  return queryOptions({
    queryKey: [INTRO_QUERY_KEYS.board],
    queryFn: () => postRequest(API_ROUTES.intros, {}, introBoardSchema),
    staleTime: INBOX_POLL_MS,
    refetchInterval: ({ state }) => (isRouteGone(state.error) ? false : readInboxPollMs(state.status === "error")),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function introCountsQuery() {
  return queryOptions({
    queryKey: [INTRO_QUERY_KEYS.counts],
    queryFn: () => postRequest(API_ROUTES.introCounts, {}, introCountsSchema),
    staleTime: INBOX_POLL_MS,
    refetchInterval: ({ state }) => (isRouteGone(state.error) ? false : readInboxPollMs(state.status === "error")),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function introDetailQuery(introId: string) {
  return queryOptions({
    queryKey: [INTRO_QUERY_KEYS.detail, introId],
    queryFn: () => postRequest(API_ROUTES.introDetail, { introId }, introSchema),
    staleTime: INBOX_POLL_MS,
    refetchInterval: ({ state }) => (isRouteGone(state.error) ? false : readInboxPollMs(state.status === "error")),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function issuedConsentQuery(introId: string) {
  return queryOptions<ConsentIssue | null>({
    queryKey: [ISSUED_CONSENT_QUERY_KEY, introId],
    queryFn: skipToken,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
}

export function createIntroRequest(body: CreateIntroBody) {
  return postRequest(API_ROUTES.introCreate, body, introSchema);
}

export function transitionIntroRequest(body: IntroTransitionBody) {
  return postRequest(API_ROUTES.introTransition, body, introWithConsentIssueSchema);
}

export function markIntrosSeenRequest(introId: string | null) {
  return postRequest(API_ROUTES.introSeen, { introId }, acknowledgedResponseSchema);
}

export function reportIntroNoteRequest(introId: string) {
  return postRequest(API_ROUTES.introReport, { introId }, acknowledgedResponseSchema);
}

export function recordIntroOutcomeRequest(body: IntroOutcomeBody) {
  return postRequest(API_ROUTES.introOutcome, body, introSchema);
}

export function makeNewConsentLinkRequest(introId: string) {
  return postRequest(API_ROUTES.introConsentLink, { introId }, introWithConsentIssueSchema);
}

export function emailConsentLinkRequest(body: ConsentEmailBody) {
  return postRequest(API_ROUTES.introConsentEmail, body, acknowledgedResponseSchema);
}

export function answerConsentRequest(body: ConsentAnswerBody) {
  return postRequest(API_ROUTES.introConsentAnswer, body, consentAnswerResponseSchema);
}
