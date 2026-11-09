"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MONTHLY_CREDIT_CAPS, USD_PER_CREDIT } from "@/platform/village/contract";
import { API_ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

const CAP_FIELD = "monthlyCreditCap";

function saveMonthlyCap(cap: number) {
  return postRequest(API_ROUTES.monthlyCap, { cap }, acknowledgedResponseSchema);
}

function readSubmittedCap(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Number(new FormData(event.currentTarget).get(CAP_FIELD));
}

export function MonthlyCapForm({ currentCap }: { currentCap: number }) {
  const router = useRouter();
  const saveMutation = useMutation({ mutationFn: saveMonthlyCap, onSuccess: () => router.refresh() });
  const defaultDollars = (MONTHLY_CREDIT_CAPS.default * USD_PER_CREDIT).toFixed(0);
  return (
    <form onSubmit={(event) => saveMutation.mutate(readSubmittedCap(event))} className="grid gap-4">
      <FormField
        name={CAP_FIELD}
        label="Credits per month, for the whole community"
        type="number"
        inputMode="numeric"
        min={MONTHLY_CREDIT_CAPS.minimum}
        max={MONTHLY_CREDIT_CAPS.maximum}
        step={1}
        required
        defaultValue={currentCap}
        hint={`The default is ${MONTHLY_CREDIT_CAPS.default.toLocaleString("en-US")}, about $${defaultDollars}. The month starts on the 1st, UTC.`}
      />
      <FormError message={saveMutation.error?.message ?? null} />
      {saveMutation.isSuccess ? <Alert variant="success">{saveMutation.data.message}</Alert> : null}
      <Button type="submit" disabled={saveMutation.isPending} className="max-sm:w-full sm:justify-self-start">
        {saveMutation.isPending ? "Saving…" : "Save the cap"}
      </Button>
    </form>
  );
}
