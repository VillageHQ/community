"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { postRequest } from "@/platform/http/post-request";

import { messageResponseSchema } from "../contract";

// Every jobs action answers with one plain sentence, and the page re-reads its data afterwards.
export function useJobAction<Body>(path: string, { onDone }: { onDone?: () => void } = {}) {
  const router = useRouter();
  return useMutation({
    mutationFn: (body: Body) => postRequest(path, body, messageResponseSchema),
    onSuccess: () => {
      onDone?.();
      router.refresh();
    },
  });
}
