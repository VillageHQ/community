"use client";

import { Eye, EyeOff, RefreshCw, Trash2 } from "lucide-react";

import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { JOB_BOARD_API_ROUTES } from "../contract";
import { useJobAction } from "./use-job-action";

type SourceActionsProps = { sourceId: string; company: string; hidden: boolean; canPull: boolean; canRemove: boolean };

export function SourceActions({ sourceId, company, hidden, canPull, canRemove }: SourceActionsProps) {
  const pull = useJobAction<{ sourceId: string }>(JOB_BOARD_API_ROUTES.pull);
  const hide = useJobAction<{ sourceId: string; hidden: boolean }>(JOB_BOARD_API_ROUTES.hide);
  const remove = useJobAction<{ sourceId: string }>(JOB_BOARD_API_ROUTES.remove);
  const actions = [pull, hide, remove];
  const done = actions.find((action) => action.isSuccess);
  const failed = actions.find((action) => action.isError);
  const isBusy = actions.some((action) => action.isPending);
  const resetOthers = () => actions.forEach((action) => action.reset());
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {canPull ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => {
              resetOthers();
              pull.mutate({ sourceId });
            }}
          >
            <RefreshCw aria-hidden="true" className={pull.isPending ? "animate-spin" : undefined} />
            {pull.isPending ? "Pulling…" : "Pull now"}
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={() => {
            resetOthers();
            hide.mutate({ sourceId, hidden: !hidden });
          }}
        >
          {hidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
          {hidden ? "Show" : "Hide"}
          <span className="sr-only"> {company}&apos;s jobs</span>
        </Button>
        {canRemove ? (
          <Button
            variant="quiet"
            size="sm"
            disabled={isBusy}
            onClick={() => {
              if (!window.confirm(`Remove ${company} and all its jobs?`)) return;
              resetOthers();
              remove.mutate({ sourceId });
            }}
          >
            <Trash2 aria-hidden="true" />
            Remove
          </Button>
        ) : null}
      </div>
      {/* A failed pull's problem is already on the card. */}
      {done && done.data?.ok !== false ? (
        <Alert variant="success" aria-live="polite">
          {done.data?.message}
        </Alert>
      ) : null}
      <FormError message={failed?.error?.message ?? null} />
    </div>
  );
}
