"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { IntroTransitionBody } from "@/modules/intros/contract";
import { INTRO_QUERY_KEYS, issuedConsentQuery, markIntrosSeenRequest, transitionIntroRequest } from "@/modules/intros/queries";

export function useIntroTransition() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (body: IntroTransitionBody) => transitionIntroRequest(body),
    onSuccess: ({ id, consentIssue }) => {
      if (consentIssue) queryClient.setQueryData(issuedConsentQuery(id).queryKey, consentIssue);
    },
    onSettled: async () => {
      await Promise.all(Object.values(INTRO_QUERY_KEYS).map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] })));
      // The intro page is rendered on the server: read it again.
      router.refresh();
    },
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
