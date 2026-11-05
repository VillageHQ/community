"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DAILY_LOOKUP_LIMITS } from "@/platform/village/contract";
import { API_ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

const LIMIT_FIELD = "dailyLookupLimit";

function saveDailyLimit(limit: number) {
  return postRequest(API_ROUTES.dailyLimit, { limit }, acknowledgedResponseSchema);
}

function readSubmittedLimit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Number(new FormData(event.currentTarget).get(LIMIT_FIELD));
}

export function DailyLimitForm({ currentLimit }: { currentLimit: number }) {
  const router = useRouter();
  const saveMutation = useMutation({ mutationFn: saveDailyLimit, onSuccess: () => router.refresh() });
  return (
    <form onSubmit={(event) => saveMutation.mutate(readSubmittedLimit(event))} className="grid gap-4">
      <FormField
        name={LIMIT_FIELD}
        label="Lookups per member, per day"
        type="number"
        inputMode="numeric"
        min={DAILY_LOOKUP_LIMITS.minimum}
        max={DAILY_LOOKUP_LIMITS.maximum}
        step={1}
        required
        defaultValue={currentLimit}
        hint={`Any whole number from ${DAILY_LOOKUP_LIMITS.minimum} to ${DAILY_LOOKUP_LIMITS.maximum}. The default is ${DAILY_LOOKUP_LIMITS.default}. It applies to everyone, and the day rolls over at midnight UTC.`}
      />
      <FormError message={saveMutation.error?.message ?? null} />
      {saveMutation.isSuccess ? <Alert variant="success">{saveMutation.data.message}</Alert> : null}
      <Button type="submit" disabled={saveMutation.isPending} className="max-sm:w-full sm:justify-self-start">
        {saveMutation.isPending ? "Saving…" : "Save the limit"}
      </Button>
    </form>
  );
}
