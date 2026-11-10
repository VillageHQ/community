"use client";

import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

function fillInNow() {
  return postRequest(API_ROUTES.networkFillIn, {}, acknowledgedResponseSchema);
}

export function FillInNowButton() {
  const router = useRouter();
  const fillIn = useMutation({ mutationFn: fillInNow, onSuccess: () => router.refresh() });
  return (
    <div className="grid gap-3">
      <Button type="button" variant="soft" disabled={fillIn.isPending} onClick={() => fillIn.mutate()} className="max-sm:w-full sm:justify-self-start">
        <RefreshCw aria-hidden="true" className={fillIn.isPending ? "animate-spin" : undefined} />
        {fillIn.isPending ? "Filling in…" : "Fill in now"}
      </Button>
      <div aria-live="polite" className="empty:hidden">
        {fillIn.isSuccess ? (
          <Alert variant="success" role="none">
            {fillIn.data.message}
          </Alert>
        ) : null}
      </div>
      <FormError message={fillIn.error?.message ?? null} />
    </div>
  );
}
