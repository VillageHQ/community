"use client";

import { Check, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASK_SKIP_ROUTE, skippedAskSchema } from "@/modules/asks/contract-today";
import { FACT_ANSWERS, FACT_FIX_LENGTH, type CheckedField } from "@/modules/members/contract-fill-in";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";

const ICON = { "aria-hidden": true, className: "fh-i fh-xs", strokeWidth: 1.5 } as const;

function useTodayAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  async function run(action: () => Promise<unknown>, flash: string) {
    setIsPending(true);
    setError(null);
    try {
      await action();
      router.push(`${ROUTES.today}?m=${flash}`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong. Try again.");
    } finally {
      setIsPending(false);
    }
  }
  return { error, isPending, run };
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p className="fh-hint fh-err" role="alert">
      {error}
    </p>
  ) : null;
}

// "Not this week": the ask leaves Today and the weekly email for this member; its author isn't told.
export function NotThisWeekButton({ askId }: { askId: string }) {
  const { error, isPending, run } = useTodayAction();
  return (
    <>
      <Button variant="secondary" disabled={isPending} onClick={() => void run(() => postRequest(ASK_SKIP_ROUTE, { askId }, skippedAskSchema), "skipped")}>
        Not this week
      </Button>
      <ErrorLine error={error} />
    </>
  );
}

// "Is this right?": Right, Hide it, or Fix it in the member's own words (Founderhall's fact card buttons).
export function FactButtons({ field, label, value }: { field: CheckedField; label: string; value: string }) {
  const { error, isPending, run } = useTodayAction();
  const answer = (kind: keyof typeof FACT_ANSWERS, fixed = "") =>
    void run(() => postRequest(API_ROUTES.profileFillInCheck, { field, answer: FACT_ANSWERS[kind], value: fixed }, acknowledgedResponseSchema), kind);
  function fix(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    answer("fix", String(new FormData(event.currentTarget).get("value") ?? ""));
  }
  return (
    <>
      <div className="fh-btn-row">
        <Button size="sm" disabled={isPending} onClick={() => answer("right")}>
          <Check {...ICON} />
          Right
        </Button>
        <Button size="sm" variant="secondary" disabled={isPending} onClick={() => answer("hide")}>
          <EyeOff {...ICON} />
          Hide it
        </Button>
      </div>
      <details className="fh-fix">
        <summary className="fh-small">Fix it</summary>
        <form className="fh-btn-row" style={{ marginTop: 8 }} onSubmit={fix}>
          <Input name="value" maxLength={FACT_FIX_LENGTH} defaultValue={value} aria-label={label} style={{ flex: "1 1 200px" }} />
          <Button size="sm" type="submit" disabled={isPending}>
            Save
          </Button>
        </form>
      </details>
      <ErrorLine error={error} />
    </>
  );
}
