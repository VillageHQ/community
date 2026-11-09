"use client";

import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";
import { formatLongDate } from "@/platform/text/format-date";
import {
  FILL_IN_BASES,
  FILL_IN_FIELD_LABELS,
  FILL_IN_FIELDS,
  FILL_IN_SOURCE_LABEL,
  LOOKUP_STATUSES,
  type FillInBasis,
  type FillInField,
  type FilledLine,
  type LookupStatus,
} from "@/modules/members/contract-fill-in";

import { saveLookupChoice } from "./lookup-question-card";

const IMAGE_FIELDS: ReadonlySet<FillInField> = new Set([FILL_IN_FIELDS.face, FILL_IN_FIELDS.companyLogo]);
const IMAGE_SIZE_PX = 40;
const SWITCH_LABEL_ID = "lookup-switch-label";

export type FillInCardState = {
  basis: FillInBasis;
  termsDate: string | null;
  isAllowed: boolean;
  status: LookupStatus | null;
  lookedUpAt: string | null;
};

// Lines the member's own words or photo replace still show here, so they can hide them too.
export type OwnWords = Partial<Record<FillInField, boolean>>;

function setLineHidden({ field, isHidden }: { field: FillInField; isHidden: boolean }) {
  return postRequest(API_ROUTES.profileFillIn, { field, isHidden }, acknowledgedResponseSchema);
}

function readBasisSentence({ basis, termsDate }: FillInCardState) {
  if (basis === FILL_IN_BASES.terms && termsDate) {
    return `Your community's membership terms, from ${formatLongDate(termsDate)}, let it fill in your card from public profiles through Village.`;
  }
  return "Your community asks before it fills in a card from public profiles through Village.";
}

function LineValue({ line }: { line: FilledLine }) {
  if (!IMAGE_FIELDS.has(line.field)) return <span className="wrap-anywhere">{line.value}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a remote picture from the lookup, shown with no referrer
    <img src={line.value} alt="" width={IMAGE_SIZE_PX} height={IMAGE_SIZE_PX} referrerPolicy="no-referrer" className="size-10 rounded-full bg-muted object-cover" />
  );
}

function FilledLineRow({ line, isReplaced }: { line: FilledLine; isReplaced: boolean }) {
  const router = useRouter();
  const visibility = useMutation({ mutationFn: setLineHidden, onSuccess: () => router.refresh() });
  const label = FILL_IN_FIELD_LABELS[line.field];
  return (
    <li className="grid gap-2 rounded-field bg-muted px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 flex-[1_1_220px] gap-1">
          <span className="type-label">{label}</span>
          <LineValue line={line} />
          <span className="type-small text-foreground-soft">
            {FILL_IN_SOURCE_LABEL}, {formatLongDate(line.filledAt)}
          </span>
          {line.isHidden ? <Tag>Hidden from your card</Tag> : null}
          {!line.isHidden && isReplaced ? <span className="type-small text-foreground-soft">Your own words are shown instead.</span> : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={visibility.isPending}
          onClick={() => visibility.mutate({ field: line.field, isHidden: !line.isHidden })}
          aria-label={`${line.isHidden ? "Show" : "Hide"} ${label.toLowerCase()} from public profiles`}
        >
          {line.isHidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
          {line.isHidden ? "Show" : "Hide"}
        </Button>
      </div>
      <FormError message={visibility.error?.message ?? null} />
    </li>
  );
}

function readEmptyNote({ status, lookedUpAt }: FillInCardState) {
  if (status === LOOKUP_STATUSES.notFound && lookedUpAt) return `We looked on ${formatLongDate(lookedUpAt)} and didn't find you. We try again every 30 days.`;
  if (status === LOOKUP_STATUSES.failed) return "The last lookup didn't work. We'll try again.";
  return "Nothing filled in yet. It happens overnight, or you can do it now.";
}

type FillInCardProps = { state: FillInCardState; lines: readonly FilledLine[]; ownWords: OwnWords; fillNowButton: ReactNode };

export function FillInCard({ state, lines, ownWords, fillNowButton }: FillInCardProps) {
  const router = useRouter();
  const choice = useMutation({ mutationFn: saveLookupChoice, onSuccess: () => router.refresh() });
  const isOn = choice.isPending ? choice.variables : state.isAllowed;
  return (
    <section aria-labelledby="fill-in-title" className="mt-5 grid gap-4 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
      <div className="grid gap-1">
        <h2 id="fill-in-title" className="type-h3">
          {FILL_IN_SOURCE_LABEL}
        </h2>
        <p className="type-small text-foreground-soft">{readBasisSentence(state)} Your own words always win.</p>
      </div>
      <div className="grid gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-0.5">
            <span id={SWITCH_LABEL_ID} className="font-bold">
              Look me up on public profiles
            </span>
            <span className="type-small text-foreground-soft">Turn this off and we stop, and remove every line below.</span>
          </div>
          <Switch aria-labelledby={SWITCH_LABEL_ID} checked={isOn} disabled={choice.isPending} onCheckedChange={(checked) => choice.mutate(checked)} />
        </div>
        <FormError message={choice.error?.message ?? null} />
      </div>
      {state.isAllowed ? (
        <>
          {lines.length > 0 ? (
            <ul className="grid gap-2.5">
              {lines.map((line) => (
                <FilledLineRow key={line.field} line={line} isReplaced={ownWords[line.field] === true} />
              ))}
            </ul>
          ) : (
            <p className="type-small rounded-field bg-muted px-4 py-3.5 text-foreground-soft">{readEmptyNote(state)}</p>
          )}
          {fillNowButton}
        </>
      ) : null}
    </section>
  );
}
