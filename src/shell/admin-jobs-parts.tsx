"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { useFlash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { SetRow } from "@/components/ui/rows";
import { Switch } from "@/components/ui/switch";
import { JOB_BOARD_API_ROUTES } from "@/modules/job-board/contract";
import { useJobAction } from "@/modules/job-board/components/use-job-action";

const COPIED_RESET_MS = 2_000;

// Founderhall's copy row: the line in a read-only mono field, Copy at the end.
export function CopyRow({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  const [wasCopied, setWasCopied] = useState(false);
  return (
    <div className="fh-r">
      <span>{icon}</span>
      <div className="fh-who">
        <input className="fh-input fh-mono fh-copyfield" readOnly value={value} aria-label={label} onFocus={(event) => event.currentTarget.select()} />
      </div>
      <div className="fh-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setWasCopied(true);
            setTimeout(() => setWasCopied(false), COPIED_RESET_MS);
          }}
        >
          {wasCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span aria-live="polite">{wasCopied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
    </div>
  );
}

// Public job board: the switch, then Save.
export function PublicBoardForm({ isPublic: savedPublic }: { isPublic: boolean }) {
  const [isPublic, setPublic] = useState(savedPublic);
  const flash = useFlash();
  const save = useJobAction<{ isPublic: boolean }>(JOB_BOARD_API_ROUTES.publicSwitch, { onDone: () => flash("Saved.") });
  return (
    <form
      className="mt-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ isPublic });
      }}
    >
      <SetRow
        htmlFor="jobs-public"
        label="Public job board"
        hint="Anyone with the link sees company, job title, location and the apply link. Never members’ names or emails."
        control={<Switch id="jobs-public" checked={isPublic} onCheckedChange={setPublic} aria-label="Public job board" />}
      />
      <FormError message={save.error?.message ?? null} />
      <div className="fh-btn-row mt-2.5">
        <Button type="submit" size="sm" disabled={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}

type SourceRowActionsProps = { sourceId: string; company: string; hidden: boolean; canPull: boolean };

// Pull now (a linked hiring tool) and Hide / Unhide, quiet at the end of the row.
export function SourceRowActions({ sourceId, company, hidden, canPull }: SourceRowActionsProps) {
  const flash = useFlash();
  const pull = useJobAction<{ sourceId: string }>(JOB_BOARD_API_ROUTES.pull);
  const hide = useJobAction<{ sourceId: string; hidden: boolean }>(JOB_BOARD_API_ROUTES.hide, { onDone: () => flash(hidden ? "Unhidden." : "Hidden.") });
  const isBusy = pull.isPending || hide.isPending;
  const error = pull.error ?? hide.error;
  return (
    <span>
      {canPull ? (
        <Button type="button" variant="quiet" size="sm" disabled={isBusy} onClick={() => pull.mutate({ sourceId }, { onSuccess: (data) => flash(data.message) })}>
          Pull now<span className="sr-only"> {company}</span>
        </Button>
      ) : null}
      <Button type="button" variant="quiet" size="sm" disabled={isBusy} onClick={() => hide.mutate({ sourceId, hidden: !hidden })}>
        {hidden ? "Unhide" : "Hide"}
        <span className="sr-only"> {company}</span>
      </Button>
      {error ? <FormError message={error.message} /> : null}
    </span>
  );
}
