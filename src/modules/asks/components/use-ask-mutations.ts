"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { AnswerAskBody, AskDraft, AskHelperBody, CloseAskBody, KnowSomeoneDraft, OfferHelpBody, OfferResult } from "@/modules/asks/contract";
import {
  answerAskRequest,
  ASK_QUERY_KEYS,
  askHelperRequest,
  knowSomeoneRequest,
  reportAnswerRequest,
  saveAllowanceRequest,
  closeAskRequest,
  createAskRequest,
  markOffersSeenRequest,
  offerHelpRequest,
  removeAskRequest,
  renewAskRequest,
  reportAskRequest,
} from "@/modules/asks/queries";

function refreshAsks(queryClient: QueryClient) {
  return Promise.all(Object.values(ASK_QUERY_KEYS).map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] })));
}

// The refresh can unmount the form that asked, and React Query drops a callback passed to mutate() when that happens.
export function useCreateAsk(onPosted: (helperCount: number) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AskDraft) => createAskRequest(body),
    onSuccess: ({ helperCount }) => {
      onPosted(helperCount);
      return refreshAsks(queryClient);
    },
  });
}

export function useOfferHelp(onOffered: (result: OfferResult) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OfferHelpBody) => offerHelpRequest(body),
    onSuccess: (result) => {
      onOffered(result);
      return refreshAsks(queryClient);
    },
  });
}

export function useCloseAsk() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (body: CloseAskBody) => closeAskRequest(body), onSuccess: () => refreshAsks(queryClient) });
}

export function useRenewAsk() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (askId: string) => renewAskRequest(askId), onSuccess: () => refreshAsks(queryClient) });
}

export function useRemoveAsk() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (askId: string) => removeAskRequest(askId), onSuccess: () => refreshAsks(queryClient) });
}

export function useReportAsk() {
  return useMutation({ mutationFn: (askId: string) => reportAskRequest(askId) });
}

// Only the badge refreshes, so each "New" tag stays on screen for the visit that first shows it.
export function useMarkOffersSeen(hasNewOffers: boolean) {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: markOffersSeenRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ASK_QUERY_KEYS.counts] }),
  });
  useEffect(() => {
    if (hasNewOffers) mutate();
  }, [hasNewOffers, mutate]);
}

export function useAnswerAsk(onAnswered: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AnswerAskBody) => answerAskRequest(body),
    onSuccess: () => {
      onAnswered();
      return refreshAsks(queryClient);
    },
  });
}

export function useReportAnswer() {
  return useMutation({ mutationFn: (answerId: string) => reportAnswerRequest(answerId) });
}

export function useKnowSomeone(onStarted: (introId: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: KnowSomeoneDraft) => knowSomeoneRequest(body),
    onSuccess: ({ introId }) => {
      onStarted(introId);
      return refreshAsks(queryClient);
    },
  });
}

export function useAskHelper(onAsked: (introId: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AskHelperBody) => askHelperRequest(body),
    onSuccess: ({ introId }) => {
      onAsked(introId);
      return refreshAsks(queryClient);
    },
  });
}

export function useSaveAllowance() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (weeklyAllowance: number) => saveAllowanceRequest(weeklyAllowance), onSuccess: () => refreshAsks(queryClient) });
}
