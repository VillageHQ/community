"use client";

import { useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";

import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

function sendNudge() {
  return postRequest(API_ROUTES.connectNudge, {}, acknowledgedResponseSchema);
}

function readButtonLabel(nudgeableCount: number) {
  return nudgeableCount === 1 ? "Remind 1 member to connect" : `Remind ${nudgeableCount} members to connect`;
}

export function ConnectNudgeButton({ nudgeableCount, isEmailOn }: { nudgeableCount: number; isEmailOn: boolean }) {
  const router = useRouter();
  const nudge = useMutation({ mutationFn: sendNudge, onSuccess: () => router.refresh() });
  if (!isEmailOn) return <p className="type-small text-foreground-soft">Reminders go by email. Turn on email in Settings to send one.</p>;
  return (
    <div className="grid gap-3">
      {nudgeableCount > 0 ? (
        <Button type="button" variant="soft" disabled={nudge.isPending} onClick={() => nudge.mutate()} className="max-sm:w-full sm:justify-self-start">
          <Send aria-hidden="true" />
          {nudge.isPending ? "Sending…" : readButtonLabel(nudgeableCount)}
        </Button>
      ) : (
        <p className="type-small text-foreground-soft">Nobody to remind right now. Each member gets at most one reminder every 30 days.</p>
      )}
      <div aria-live="polite" className="empty:hidden">
        {nudge.isSuccess ? (
          <Alert variant="success" role="none">
            {nudge.data.message}
          </Alert>
        ) : null}
      </div>
      <FormError message={nudge.error?.message ?? null} />
    </div>
  );
}
