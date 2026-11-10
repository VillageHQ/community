"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";
import { FILL_IN_BASES, type FillInBasis, type FillInBasisBody } from "@/modules/members/contract-fill-in";

const BASIS_FIELD = "fillInBasis";
const TERMS_DATE_FIELD = "fillInTermsDate";
const OFF = "off";

type BasisChoice = FillInBasis | typeof OFF;

const CHOICES: { value: BasisChoice; title: string; description: string }[] = [
  { value: OFF, title: "Off", description: "Nobody is looked up, and lines already filled in are removed. Cards hold only what members write." },
  {
    value: FILL_IN_BASES.terms,
    title: "Our membership terms allow it",
    description: "Members agreed, in your terms, that you may fill in their card from public profiles. Each member can still say no.",
  },
  {
    value: FILL_IN_BASES.ask,
    title: "Ask each member first",
    description: "Each member sees a yes-or-no question when they next open the site. Nobody is looked up before they say yes.",
  },
];

function saveBasis(body: FillInBasisBody) {
  return postRequest(API_ROUTES.adminFillIn, body, acknowledgedResponseSchema);
}

function runFillIn() {
  return postRequest(API_ROUTES.adminFillInRun, {}, acknowledgedResponseSchema);
}

function readSubmittedBasis(event: FormEvent<HTMLFormElement>): FillInBasisBody {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const basis = String(form.get(BASIS_FIELD) ?? OFF);
  if (basis === FILL_IN_BASES.terms) return { basis, termsDate: String(form.get(TERMS_DATE_FIELD) ?? "") };
  if (basis === FILL_IN_BASES.ask) return { basis };
  return { basis: OFF };
}

type FillInSettingsFormProps = { basis: FillInBasis | null; termsDate: string | null };

export function FillInSettingsForm({ basis, termsDate }: FillInSettingsFormProps) {
  const router = useRouter();
  const [choice, setChoice] = useState<BasisChoice>(basis ?? OFF);
  const save = useMutation({ mutationFn: saveBasis, onSuccess: () => router.refresh() });
  const run = useMutation({ mutationFn: runFillIn, onSuccess: () => router.refresh() });

  return (
    <div className="grid gap-5">
      <form onSubmit={(event) => save.mutate(readSubmittedBasis(event))} className="grid gap-4">
        <fieldset className="grid gap-2.5">
          <legend className="type-label mb-2">What lets you fill in members&apos; cards?</legend>
          {CHOICES.map(({ value, title, description }) => (
            <label
              key={value}
              className="flex items-start gap-3.5 rounded-field px-card-phone py-3 shadow-[inset_0_0_0_1.5px_var(--input)] has-checked:shadow-[inset_0_0_0_2.5px_var(--brand-emphasis)]"
            >
              <input
                type="radio"
                name={BASIS_FIELD}
                value={value}
                checked={choice === value}
                onChange={() => setChoice(value)}
                className="mt-1 size-5 shrink-0 accent-[var(--brand-emphasis)]"
              />
              <span className="grid gap-0.5">
                <span className="font-bold">{title}</span>
                <span className="type-small text-foreground-soft">{description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {choice === FILL_IN_BASES.terms ? (
          <FormField
            name={TERMS_DATE_FIELD}
            label="Date of the terms that say so"
            type="date"
            required
            defaultValue={termsDate ?? ""}
            hint="Keep a copy of those terms. This date is shown to members on their card."
          />
        ) : null}
        <FormError message={save.error?.message ?? null} />
        {save.isSuccess ? <Alert variant="success">{save.data.message}</Alert> : null}
        <Button type="submit" disabled={save.isPending} className="max-sm:w-full sm:justify-self-start">
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </form>

      {basis ? (
        <div className="grid gap-3 border-t border-border pt-5">
          <p className="type-small text-foreground-soft">
            Cards are filled in every night. A new member is looked up by email, then refreshed by LinkedIn every 30 days. Each lookup that finds someone costs about 1 credit.
          </p>
          <Button type="button" variant="outline" disabled={run.isPending} onClick={() => run.mutate()} className="max-sm:w-full sm:justify-self-start">
            {run.isPending ? "Filling in…" : "Fill in everyone now"}
          </Button>
          <div aria-live="polite" className="empty:hidden">
            {run.isSuccess ? (
              <Alert variant="success" role="none">
                {run.data.message}
              </Alert>
            ) : null}
          </div>
          <FormError message={run.error?.message ?? null} />
        </div>
      ) : null}
    </div>
  );
}
