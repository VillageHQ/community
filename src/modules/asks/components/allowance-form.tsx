"use client";

import type { FormEvent } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ASK_ALLOWANCE, ASK_LIMITS } from "@/modules/asks/contract";

import { useSaveAllowance } from "./use-ask-mutations";

const ALLOWANCE_FIELD = "weeklyAllowance";

// Admin › Asks: how many asks each member may post a week. Posted asks and intro asks share it.
export function AllowanceForm({ weeklyAllowance }: { weeklyAllowance: number }) {
  const saveAllowance = useSaveAllowance();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveAllowance.mutate(Number(new FormData(event.currentTarget).get(ALLOWANCE_FIELD)));
  }
  return (
    <form className="grid gap-3" onSubmit={submit}>
      <FormField
        name={ALLOWANCE_FIELD}
        label="Asks per member, per week"
        type="number"
        inputMode="numeric"
        min={ASK_ALLOWANCE.minimum}
        max={ASK_ALLOWANCE.maximum}
        step={1}
        required
        defaultValue={weeklyAllowance}
        hint={`Posted asks and intro asks share it. Any whole number from ${ASK_ALLOWANCE.minimum} to ${ASK_ALLOWANCE.maximum}. The default is ${ASK_ALLOWANCE.default}. Each member can also receive at most ${ASK_LIMITS.connectorWeeklyCap} intro asks a week.`}
      />
      <FormError message={saveAllowance.error?.message ?? null} />
      {saveAllowance.isSuccess ? (
        <Alert variant="success" role="none">
          Saved. Members now get {saveAllowance.data.weeklyAllowance} asks a week.
        </Alert>
      ) : null}
      <Button type="submit" disabled={saveAllowance.isPending} className="max-sm:w-full sm:justify-self-start">
        {saveAllowance.isPending ? "Saving…" : "Save the allowance"}
      </Button>
    </form>
  );
}
