"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { AskDraft, CloseAskBody, OfferHelpBody, OfferResult } from "@/modules/asks/contract";
import {
  ASK_QUERY_KEYS,
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
export function useCreateAsk(onPosted: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AskDraft) => createAskRequest(body),
    onSuccess: () => {
      onPosted();
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
