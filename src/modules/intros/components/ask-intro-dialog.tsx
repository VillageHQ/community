"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronRight, CircleCheck, Link2, Lock, X } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { Fragment, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";

import type { ConstellationPerson } from "@/components/constellation";
import { FormError } from "@/components/form-error";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { readFirstName } from "@/platform/design/avatar-identity";
import { INTRO_LIMITS, type Intro } from "@/modules/intros/contract";
import { composeStarterNote, readConsentPromise, readIntroPromise, readNoteSharingLine } from "@/modules/intros/copy";
import { createIntroRequest, INTRO_QUERY_KEYS } from "@/modules/intros/queries";
import { ROUTES } from "@/platform/http/routes";
import type { Connector, NetworkPaths } from "@/modules/network/contract";

import { networkPathsQuery } from "@/modules/network/queries";

const NOTE_NEEDS_WHY = "Add a line about why you'd like to meet them, so they can decide.";
const PREVIEW_AVATAR_SIZE_PX = 44;

type AskIntroDialogProps = {
  connector: Connector;
  connectorSlug: string;
  targetSlug: string;
  targetName: string;
  viewer: ConstellationPerson;
  trigger: ReactNode | null;
  afterAskFocus: RefObject<HTMLAnchorElement | null>;
};

function markAskedInCache(paths: NetworkPaths | undefined, connectorSlug: string, intro: Intro) {
  if (!paths) return paths;
  return {
    ...paths,
    connectors: paths.connectors.map((connector) =>
      connector.linkedinSlug === connectorSlug ? { ...connector, openAsk: { id: intro.id, state: intro.state } } : connector,
    ),
  };
}

function focusAtEnd(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

function IntroducerPreview({ viewer, targetName, note, reason }: { viewer: ConstellationPerson; targetName: string; note: string; reason: string }) {
  return (
    <div className="grid gap-3 rounded-field bg-muted p-4">
      <div className="flex items-center gap-3">
        <Avatar stableId={viewer.id} name={viewer.name} imageUrl={viewer.imageUrl} sizePx={PREVIEW_AVATAR_SIZE_PX} />
        <div className="min-w-0">
          <p className="type-label wrap-anywhere">{viewer.name}</p>
          <p className="type-small wrap-anywhere text-foreground-soft">asks for an intro to {targetName}</p>
        </div>
      </div>
      <p className="type-small wrap-anywhere whitespace-pre-wrap text-foreground">{note.trim()}</p>
      <p className="type-small flex gap-2 text-foreground-soft">
        <Link2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-emphasis" />
        <span className="min-w-0">{reason}</span>
      </p>
    </div>
  );
}

// The way in, on top: who passes the note on, and why they know each other.
function AskPath({ connector, targetName }: { connector: Connector; targetName: string }) {
  const names = ["You", connector.name, ...(connector.throughName ? [connector.throughName] : []), targetName];
  return (
    <div className="grid gap-1">
      <p className="type-small flex flex-wrap items-center gap-x-2 font-semibold text-foreground-soft">
        {names.map((name, position) => (
          <Fragment key={`${position}-${name}`}>
            {position > 0 ? (
              <span className="font-normal text-muted-foreground">
                <span aria-hidden="true">→</span>
                <span className="sr-only">then</span>
              </span>
            ) : null}
            <span className="wrap-anywhere">{name}</span>
          </Fragment>
        ))}
      </p>
      <p className="type-small wrap-anywhere text-muted-foreground">{connector.reason}</p>
    </div>
  );
}

function SentConfirmation({ introducerFirst, targetFirst, introId }: { introducerFirst: string; targetFirst: string; introId: string }) {
  return (
    <div className="grid justify-items-center gap-3 py-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-accent text-brand-emphasis" aria-hidden="true">
        <CircleCheck className="size-8" />
      </span>
      <Dialog.Title tabIndex={-1} className="type-h2">
        Your intro request is on its way
      </Dialog.Title>
      <p className="type-body text-foreground-soft">
        {introducerFirst} reads your note first. {targetFirst} hears nothing unless they say yes. {readConsentPromise(targetFirst)}
      </p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <Button asChild size="lg">
          <Link href={`${ROUTES.intros}/${introId}`}>See your intro request</Link>
        </Button>
        <Dialog.Close asChild>
          <Button type="button" variant="quiet" size="lg">
            Keep looking
          </Button>
        </Dialog.Close>
      </div>
    </div>
  );
}

function useAskIntro({ connector, connectorSlug, targetSlug, targetName }: Omit<AskIntroDialogProps, "viewer" | "trigger" | "afterAskFocus">) {
  const queryClient = useQueryClient();
  const noteField = useRef<HTMLTextAreaElement>(null);
  const starterNote = composeStarterNote(connector.name, targetName);
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState(starterNote);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const ask = useMutation({
    mutationFn: () => createIntroRequest({ targetSlug, connectorSlug, note }),
    onSuccess: async (intro) => {
      queryClient.setQueryData(networkPathsQuery(targetSlug).queryKey, (paths) => markAskedInCache(paths, connectorSlug, intro));
      await queryClient.invalidateQueries({ queryKey: [INTRO_QUERY_KEYS.board] });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (note.trim() === starterNote.trim()) {
      setValidationMessage(NOTE_NEEDS_WHY);
      noteField.current?.focus();
      return;
    }
    setValidationMessage(null);
    ask.mutate();
  }

  function changeOpen(nextIsOpen: boolean) {
    setIsOpen(nextIsOpen);
    if (nextIsOpen) return;
    ask.reset();
    setValidationMessage(null);
  }

  function changeNote(nextNote: string) {
    setNote(nextNote);
    setValidationMessage(null);
  }

  return { noteField, isOpen, note, changeNote, ask, submit, changeOpen, validationMessage };
}

export function AskIntroDialog(props: AskIntroDialogProps) {
  const { connector, targetName, viewer, trigger, afterAskFocus } = props;
  const { noteField, isOpen, note, changeNote, ask, submit, changeOpen, validationMessage } = useAskIntro(props);
  const noteId = useId();
  const hintId = useId();
  const introducerFirst = readFirstName(connector.name);
  const targetFirst = readFirstName(targetName);
  const errorMessage = validationMessage ?? ask.error?.message ?? null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={changeOpen}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-[rgb(10_12_10/0.48)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusAtEnd(noteField.current);
          }}
          onCloseAutoFocus={(event) => {
            if (!afterAskFocus.current) return;
            event.preventDefault();
            afterAskFocus.current.focus();
          }}
          className="fixed inset-x-0 bottom-0 z-40 max-h-[92dvh] overflow-y-auto rounded-t-[32px] bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),24px)] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-panel sm:p-7"
        >
          {ask.data ? (
            <SentConfirmation introducerFirst={introducerFirst} targetFirst={targetFirst} introId={ask.data.id} />
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              <div className="flex items-start justify-between gap-3">
                <Dialog.Title className="type-h2 min-w-0 wrap-anywhere">
                  Ask {introducerFirst} to introduce you to {targetFirst}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <Button type="button" variant="quiet" size="icon" aria-label="Close" className="-mt-1 -mr-1 shrink-0">
                    <X aria-hidden="true" />
                  </Button>
                </Dialog.Close>
              </div>
              <AskPath connector={connector} targetName={targetName} />
              <div className="grid gap-2">
                <Label htmlFor={noteId}>One note to {introducerFirst}</Label>
                <Textarea
                  ref={noteField}
                  id={noteId}
                  rows={6}
                  required
                  maxLength={INTRO_LIMITS.noteLength}
                  value={note}
                  aria-describedby={hintId}
                  aria-invalid={validationMessage !== null}
                  onChange={(event) => changeNote(event.target.value)}
                />
                <p id={hintId} className="type-small text-muted-foreground">
                  Say who you are and why {targetFirst}. {note.length} of {INTRO_LIMITS.noteLength} characters.
                </p>
              </div>
              <details className="group">
                <summary className="type-small flex min-h-11 w-fit list-none items-center gap-1.5 text-foreground-soft underline underline-offset-2 hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-90" />
                  See exactly what {introducerFirst} gets
                </summary>
                <div className="mt-1">
                  <IntroducerPreview viewer={viewer} targetName={targetName} note={note} reason={connector.reason} />
                </div>
              </details>
              <p className="type-small flex gap-2.5 text-foreground-soft">
                <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  {readIntroPromise(connector.name, targetName)} {readNoteSharingLine(connector.name, targetName)}
                </span>
              </p>
              <FormError message={errorMessage} />
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button type="submit" size="lg" disabled={ask.isPending} className="sm:flex-1">
                  {ask.isPending ? "Sending…" : `Send to ${introducerFirst}`}
                  <ArrowRight aria-hidden="true" />
                </Button>
                <Dialog.Close asChild>
                  <Button type="button" variant="quiet" size="lg">
                    Not now
                  </Button>
                </Dialog.Close>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
