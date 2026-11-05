"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { IntroTransitionBody } from "@/lib/intros/intro-api";
import { INTRO_QUERY_KEYS, markIntrosSeenRequest, transitionIntroRequest } from "@/lib/intros/intro-queries";

export function useIntroTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: IntroTransitionBody) => transitionIntroRequest(body),
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
