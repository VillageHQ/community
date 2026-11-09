"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { IntroTransitionBody } from "@/modules/intros/contract";
import { INTRO_QUERY_KEYS, issuedConsentQuery, markIntrosSeenRequest, transitionIntroRequest } from "@/modules/intros/queries";

export function useIntroTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: IntroTransitionBody) => transitionIntroRequest(body),
    onSuccess: ({ id, consentIssue }) => {
      if (consentIssue) queryClient.setQueryData(issuedConsentQuery(id).queryKey, consentIssue);
    },
    onSettled: () =>
      Promise.all(
        Object.values(INTRO_QUERY_KEYS).map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] })),
      ),
  });
}

export function useMarkIntrosSeen(hasUpdates: boolean, introId: string | null) {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: () => markIntrosSeenRequest(introId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INTRO_QUERY_KEYS.counts] }),
  });
  useEffect(() => {
    if (hasUpdates) mutate();
  }, [hasUpdates, mutate]);
}
