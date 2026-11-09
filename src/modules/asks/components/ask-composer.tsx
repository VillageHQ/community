"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type FormEvent } from "react";

import { FormError } from "@/components/form-error";
import { FormField, TextareaField } from "@/components/form-field";
import { QueryBoundary } from "@/components/query-boundary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ASK_CATEGORIES, ASK_KINDS, ASK_LIMITS, describeAllowance, type AskAllowance, type AskCategory, type AskKind } from "@/modules/asks/contract";
import { formatLongDate } from "@/platform/text/format-date";
import { ownAsksQuery } from "@/modules/asks/queries";

import { CATEGORIES, CATEGORY_DISPLAY } from "./ask-display";
import { CharactersLeft } from "./characters-left";
import { useCreateAsk } from "./use-ask-mutations";

const TITLE_FIELD = "ask-title";
const DETAIL_FIELD = "ask-detail";
const TARGET_FIELD = "ask-target";
const KIND_LABEL_ID = "ask-kind-label";
const UPDATE_EXAMPLE = "We closed our first enterprise customer";
const TITLE_EXAMPLE = "Looking for a fractional CFO who's done a Series A";
const CATEGORY_LABEL_ID = "ask-category-label";

type OnPosted = (kind: AskKind, helperCount: number) => void;

function AllowanceLine({ allowance }: { allowance: AskAllowance }) {
  return (
    <p className="type-small text-foreground-soft">
      {describeAllowance(allowance)}. Asks you post and intro asks share it.
    </p>
  );
}

function KindChoice({ kind, onChange }: { kind: AskKind; onChange: (kind: AskKind) => void }) {
  return (
    <div className="grid gap-2">
      <p id={KIND_LABEL_ID} className="type-label">
        What are you posting?
      </p>
      <div role="group" aria-labelledby={KIND_LABEL_ID} className="flex flex-wrap gap-2">
        <Chip isPressed={kind === ASK_KINDS.ask} onClick={() => onChange(ASK_KINDS.ask)}>
          An ask
        </Chip>
        <Chip isPressed={kind === ASK_KINDS.update} onClick={() => onChange(ASK_KINDS.update)}>
          An update, like a win
        </Chip>
      </div>
    </div>
  );
}

function AskForm({ onPosted, allowance }: { onPosted: OnPosted; allowance: AskAllowance }) {
  const [kind, setKind] = useState<AskKind>(ASK_KINDS.ask);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [targetLinkedin, setTargetLinkedin] = useState("");
  const [category, setCategory] = useState<AskCategory | null>(null);
  const createAsk = useCreateAsk((helperCount) => onPosted(kind, helperCount));
  const isAsk = kind === ASK_KINDS.ask;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createAsk.mutate({
      title,
      detail: detail.trim() || null,
      kind,
      category: isAsk ? category : ASK_CATEGORIES.other,
      targetLinkedin: isAsk ? targetLinkedin.trim() || null : null,
    });
  }

  if (isAsk && allowance.left === 0) {
    return (
      <div className="grid gap-5">
        <KindChoice kind={kind} onChange={setKind} />
        <Alert variant="info" role="none">
          You&apos;ve used this week&apos;s {allowance.cap} asks.
          {allowance.backAt ? ` The next one comes back on ${formatLongDate(allowance.backAt)}.` : ""} You can still share an update.
        </Alert>
      </div>
    );
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <KindChoice kind={kind} onChange={setKind} />
      <div className="grid gap-1.5">
        <FormField
          name={TITLE_FIELD}
          label={isAsk ? "What do you need?" : "What happened?"}
          placeholder={isAsk ? TITLE_EXAMPLE : UPDATE_EXAMPLE}
          autoFocus
          autoComplete="off"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <CharactersLeft length={title.length} maximumLength={ASK_LIMITS.titleLength} />
      </div>
      {isAsk ? (
      <div className="grid gap-2">
        <p id={CATEGORY_LABEL_ID} className="type-label">
          What kind of help is it?
        </p>
        <div role="group" aria-labelledby={CATEGORY_LABEL_ID} className="flex flex-wrap gap-2">
          {CATEGORIES.map((choice) => {
            const { label, icon: Icon } = CATEGORY_DISPLAY[choice];
            return (
              <Chip key={choice} isPressed={category === choice} onClick={() => setCategory(choice)}>
                <Icon aria-hidden="true" className="size-icon-small" />
                {label}
              </Chip>
            );
          })}
        </div>
      </div>
      ) : null}
      {isAsk ? (
        <FormField
          name={TARGET_FIELD}
          label="Someone specific you want to reach? (optional)"
          placeholder="https://www.linkedin.com/in/their-name"
          autoComplete="off"
          inputMode="url"
          value={targetLinkedin}
          onChange={(event) => setTargetLinkedin(event.target.value)}
          hint="Paste their LinkedIn link, and we'll tell members who know them."
        />
      ) : null}
      <div className="grid gap-1.5">
        <TextareaField
          name={DETAIL_FIELD}
          label="Anything else that would help? (optional)"
          placeholder="Who you've tried, your timeline, what a good answer looks like."
          rows={3}
          className="resize-none field-sizing-content"
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
        />
        <CharactersLeft length={detail.length} maximumLength={ASK_LIMITS.detailLength} />
      </div>
      <p className="type-small text-foreground-soft">
        {isAsk
          ? `Your ask stays up for ${ASK_LIMITS.lifetimeDays} days, and members who may help hear about it once. You can close it sooner, or renew it.`
          : `Your update stays up for ${ASK_LIMITS.lifetimeDays} days.`}
      </p>
      {isAsk ? <AllowanceLine allowance={allowance} /> : null}
      <FormError message={createAsk.error?.message ?? null} />
      <Button type="submit" size="lg" disabled={createAsk.isPending}>
        {createAsk.isPending ? "Posting…" : isAsk ? "Post my ask" : "Post my update"}
      </Button>
    </form>
  );
}

function AskFormOrLimit({ onPosted, onSeeYourAsks }: { onPosted: OnPosted; onSeeYourAsks: () => void }) {
  const { data } = useSuspenseQuery(ownAsksQuery());
  if (data.openCount < ASK_LIMITS.openPerMember) return <AskForm onPosted={onPosted} allowance={data.allowance} />;
  return (
    <div className="grid gap-4">
      <Alert variant="info" role="none">
        You have {ASK_LIMITS.openPerMember} open asks, which is the most you can have at once. Close one you&apos;ve sorted out, and you can post this.
      </Alert>
      <Dialog.Close asChild>
        <Button type="button" size="lg" onClick={onSeeYourAsks}>
          See your asks
        </Button>
      </Dialog.Close>
    </div>
  );
}

type AskComposerProps = { isOpen: boolean; onOpenChange: (isOpen: boolean) => void; onPosted: OnPosted; onSeeYourAsks: () => void };

export function AskComposer({ isOpen, onOpenChange, onPosted, onSeeYourAsks }: AskComposerProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-[rgb(10_12_10/0.48)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-40 max-h-[92dvh] overflow-y-auto rounded-t-[32px] bg-card px-4 pt-5 pb-[max(env(safe-area-inset-bottom),24px)] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-panel sm:p-7"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="type-h2">Ask your community</Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="quiet" size="icon" aria-label="Close" className="-mt-1 -mr-1">
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <QueryBoundary loadingMessage="Just a moment…">
            <AskFormOrLimit onPosted={onPosted} onSeeYourAsks={onSeeYourAsks} />
          </QueryBoundary>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
