"use client";

import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

import { JOB_BOARD_API_ROUTES } from "../contract";
import { useJobAction } from "./use-job-action";

export function PublicBoardSwitch({ isPublic }: { isPublic: boolean }) {
  const save = useJobAction<{ isPublic: boolean }>(JOB_BOARD_API_ROUTES.publicSwitch);
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <Switch id="job-board-public" checked={isPublic} disabled={save.isPending} onCheckedChange={(checked) => save.mutate({ isPublic: checked })} />
        <label htmlFor="job-board-public" className="font-bold">
          {isPublic ? "Anyone with the link can see the board" : "Only members can see the board"}
        </label>
      </div>
      {save.isSuccess ? (
        <Alert variant="success" aria-live="polite">
          {save.data.message}
        </Alert>
      ) : null}
      <FormError message={save.error?.message ?? null} />
    </div>
  );
}
