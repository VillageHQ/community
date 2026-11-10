"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { FormError } from "@/components/form-error";
import { TextareaField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

import { PERKS_API_ROUTES, PERKS_HELP_URL, PERKS_LIMITS } from "../contract";

const CODE_FIELD = "perksEmbedCode";
const CODE_PLACEHOLDER = '<iframe src="https://yourcommunity.builtfirst.com/…"></iframe>';

export function PerksForm({ hasMarketplace }: { hasMarketplace: boolean }) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const save = useMutation({
    mutationFn: (code: string) => postRequest(PERKS_API_ROUTES.save, { code }, acknowledgedResponseSchema),
    onSuccess: () => router.refresh(),
  });
  const remove = useMutation({
    mutationFn: () => postRequest(PERKS_API_ROUTES.remove, {}, acknowledgedResponseSchema),
    onSuccess: () => {
      setIsConfirming(false);
      router.refresh();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    remove.reset();
    save.mutate(String(new FormData(event.currentTarget).get(CODE_FIELD) ?? ""));
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={submit} className="grid gap-4">
        <TextareaField
          name={CODE_FIELD}
          label="BuiltFirst embed code"
          rows={5}
          required
          maxLength={PERKS_LIMITS.codeCharacters}
          spellCheck={false}
          className="font-mono text-[14px]"
          placeholder={CODE_PLACEHOLDER}
          aria-invalid={save.isError || undefined}
          hint="In BuiltFirst, open your marketplace's Settings, Embed, and copy the code. Only the frame's address on builtfirst.com is kept; anything else in the code is dropped."
        />
        <p className="type-small">
          <a href={PERKS_HELP_URL} target="_blank" rel="noreferrer" className="font-bold text-brand-emphasis underline hover:no-underline">
            BuiltFirst&apos;s guide to the embed code
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
        <FormError message={save.error?.message ?? null} />
        {save.isSuccess ? <Alert variant="success">{save.data.message}</Alert> : null}
        {remove.isSuccess ? <Alert variant="success">{remove.data.message}</Alert> : null}
        <Button type="submit" disabled={save.isPending} className="max-sm:w-full sm:justify-self-start">
          {save.isPending ? "Saving…" : hasMarketplace ? "Replace the marketplace" : "Save the marketplace"}
        </Button>
      </form>
      {hasMarketplace && isConfirming ? (
        <ConfirmAction
          message="Remove the marketplace? Members stop seeing Perks until you paste a code again."
          confirmLabel="Remove"
          pendingLabel="Removing…"
          cancelLabel="Keep it"
          isPending={remove.isPending}
          errorMessage={remove.error?.message ?? null}
          onConfirm={() => remove.mutate()}
          onCancel={() => setIsConfirming(false)}
        />
      ) : null}
      {hasMarketplace && !isConfirming ? (
        <Button type="button" variant="quiet" size="sm" onClick={() => setIsConfirming(true)} className="max-sm:w-full sm:justify-self-start">
          Remove the marketplace
        </Button>
      ) : null}
    </div>
  );
}
