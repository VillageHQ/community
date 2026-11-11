"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FLASH_KINDS, useFlash } from "@/components/flash";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SetRow } from "@/components/ui/rows";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

import { PERKS_API_ROUTES, PERKS_HELP_URL, PERKS_LIMITS, PERKS_NOT_SAVED_MESSAGE } from "../contract";

// Founderhall's Admin › Perks form (lib/perks.mjs): the embed code, the saved address, "Show Perks to members", then
// Save perks and, with a marketplace saved, Remove the marketplace. The page refreshes with a flash.
const CODE_FIELD = "perksEmbedCode";
const SHOWN_FIELD = "perksShown";
const CODE_PLACEHOLDER = '<iframe src="https://yourfund.builtfirst.com/…"></iframe>';

export function PerksForm({ savedUrl, isShown }: { savedUrl: string | null; isShown: boolean }) {
  const router = useRouter();
  const flash = useFlash();
  const [isOn, setIsOn] = useState(savedUrl === null || isShown);
  const onSaved = () => {
    flash("Settings saved.");
    router.refresh();
  };
  const save = useMutation({
    mutationFn: (body: { code: string; isShown: boolean }) => postRequest(PERKS_API_ROUTES.save, body, acknowledgedResponseSchema),
    onSuccess: onSaved,
    onError: () => flash(PERKS_NOT_SAVED_MESSAGE, { kind: FLASH_KINDS.needs }),
  });
  const remove = useMutation({
    mutationFn: () => postRequest(PERKS_API_ROUTES.remove, {}, acknowledgedResponseSchema),
    onSuccess: onSaved,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    remove.reset();
    save.mutate({ code: String(new FormData(event.currentTarget).get(CODE_FIELD) ?? ""), isShown: isOn });
  }

  const error = save.error?.message ?? remove.error?.message ?? null;
  return (
    <Card className="fh-sheet">
      <form onSubmit={submit}>
        <h2 className="type-h3">BuiltFirst embed code</h2>
        <Field
          htmlFor={CODE_FIELD}
          label="Embed code"
          hint={
            <>
              In BuiltFirst, open your marketplace’s Settings › Embed and copy the code. <a href={PERKS_HELP_URL}>BuiltFirst’s guide</a>. Only the frame’s address on
              builtfirst.com is kept; any script in the code is dropped.
            </>
          }
          error={error}
          className="fh-field"
        >
          <Textarea
            id={CODE_FIELD}
            name={CODE_FIELD}
            rows={5}
            maxLength={PERKS_LIMITS.codeCharacters}
            spellCheck={false}
            placeholder={CODE_PLACEHOLDER}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${CODE_FIELD}-hint`}
            className="mb-1.5 min-h-0 font-mono"
          />
        </Field>
        {savedUrl ? (
          <p className="fh-small mt-2 wrap-anywhere">
            Saved address: <span className="font-mono text-[13px]">{savedUrl}</span>
          </p>
        ) : null}
        <div className="mt-3 [&_.fh-setrow]:border-b [&_.fh-setrow]:border-rule">
          <SetRow
            htmlFor={SHOWN_FIELD}
            label="Show Perks to members"
            hint="On: a Perks page, a card on Today and a menu entry. Off: hidden from members."
            control={<Switch id={SHOWN_FIELD} checked={isOn} onCheckedChange={setIsOn} />}
          />
        </div>
        <div className="fh-btn-row mt-3.5">
          <Button type="submit" disabled={save.isPending || remove.isPending}>
            Save perks
          </Button>
          {savedUrl ? (
            <Button
              type="button"
              variant="secondary"
              disabled={save.isPending || remove.isPending}
              onClick={() => {
                save.reset();
                remove.mutate();
              }}
            >
              Remove the marketplace
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
