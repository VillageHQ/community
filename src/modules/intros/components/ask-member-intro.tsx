"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CircleCheck, Handshake, Lock, X } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { useId, useRef, useState, type FormEvent } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";
import { INTRO_LIMITS } from "@/modules/intros/contract";
import { composeStarterNote, readConsentPromise, readIntroPromise } from "@/modules/intros/copy";
import { createIntroRequest, INTRO_QUERY_KEYS } from "@/modules/intros/queries";

type AskMemberIntroProps = { connectorId: string; connectorName: string };

const EMPTY_PERSON = { name: "", company: "", email: "", linkedin: "" };

function Field({ label, hint, children }: { label: string; hint?: string; children: (ids: { id: string; hintId: string | undefined }) => React.ReactNode }) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, hintId: hint ? hintId : undefined })}
      {hint ? (
        <p id={hintId} className="type-small text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function SentConfirmation({ connectorFirst, targetFirst, introId }: { connectorFirst: string; targetFirst: string; introId: string }) {
  return (
    <div className="grid justify-items-center gap-3 py-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-accent text-brand-emphasis" aria-hidden="true">
        <CircleCheck className="size-8" />
      </span>
      <Dialog.Title tabIndex={-1} className="type-h2">
        Your intro request is on its way
      </Dialog.Title>
      <p className="type-body text-foreground-soft">
        {connectorFirst} reads your note first. {targetFirst} hears nothing unless they say yes. {readConsentPromise(targetFirst)}
      </p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <Button asChild size="lg">
          <Link href={`${ROUTES.intros}/${introId}`}>See your intro request</Link>
        </Button>
        <Dialog.Close asChild>
          <Button type="button" variant="quiet" size="lg">
            Done
          </Button>
        </Dialog.Close>
      </div>
    </div>
  );
}

// "Ask <name> for an intro" on a member's profile: the asker names the person. It needs no Village.
export function AskMemberIntro({ connectorId, connectorName }: AskMemberIntroProps) {
  const queryClient = useQueryClient();
  const nameField = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [person, setPerson] = useState(EMPTY_PERSON);
  const [why, setWhy] = useState("");
  const connectorFirst = readFirstName(connectorName);
  const targetName = person.name.trim();
  const targetFirst = targetName ? readFirstName(targetName) : null;
  const starter = composeStarterNote(connectorName, targetName || "them");
  const noteRoom = INTRO_LIMITS.noteLength - starter.length;

  const ask = useMutation({
    mutationFn: () =>
      createIntroRequest({
        connectorId,
        target: { name: person.name, company: person.company, email: person.email || null, linkedin: person.linkedin || null },
        note: `${starter}${why.trim()}`,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INTRO_QUERY_KEYS.board] }),
  });

  function changeOpen(nextIsOpen: boolean) {
    setIsOpen(nextIsOpen);
    if (nextIsOpen) return;
    if (ask.data) {
      setPerson(EMPTY_PERSON);
      setWhy("");
    }
    ask.reset();
  }

  function update(field: keyof typeof EMPTY_PERSON, value: string) {
    setPerson((current) => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask.mutate();
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="lg" className="max-sm:w-full">
          <Handshake aria-hidden="true" />
          Ask {connectorFirst} for an intro
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-[rgb(10_12_10/0.48)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            nameField.current?.focus();
          }}
          className="fixed inset-x-0 bottom-0 z-40 max-h-[92dvh] overflow-y-auto rounded-t-[32px] bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),24px)] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-panel sm:p-7"
        >
          {ask.data ? (
            <SentConfirmation connectorFirst={connectorFirst} targetFirst={readFirstName(ask.data.target.name)} introId={ask.data.id} />
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              <div className="flex items-start justify-between gap-3">
                <Dialog.Title className="type-h2 min-w-0 wrap-anywhere">Ask {connectorFirst} for an intro</Dialog.Title>
                <Dialog.Close asChild>
                  <Button type="button" variant="quiet" size="icon" aria-label="Close" className="-mt-1 -mr-1 shrink-0">
                    <X aria-hidden="true" />
                  </Button>
                </Dialog.Close>
              </div>
              <p className="type-small text-foreground-soft">Who should {connectorFirst} introduce you to?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Their name">
                  {({ id }) => (
                    <Input ref={nameField} id={id} required autoComplete="off" maxLength={INTRO_LIMITS.nameLength} value={person.name} onChange={(event) => update("name", event.target.value)} />
                  )}
                </Field>
                <Field label="Their company">
                  {({ id }) => (
                    <Input id={id} required autoComplete="off" maxLength={INTRO_LIMITS.headlineLength} value={person.company} onChange={(event) => update("company", event.target.value)} />
                  )}
                </Field>
              </div>
              <Field label="Their email (optional)" hint={`Only ${connectorFirst} sees it, to email ${targetFirst ?? "them"} the yes-or-no link. We delete it when the intro closes.`}>
                {({ id, hintId }) => (
                  <Input id={id} type="email" autoComplete="off" maxLength={INTRO_LIMITS.emailLength} value={person.email} aria-describedby={hintId} onChange={(event) => update("email", event.target.value)} />
                )}
              </Field>
              <Field label="Their LinkedIn link (optional)">
                {({ id }) => (
                  <Input id={id} type="url" inputMode="url" autoComplete="off" placeholder="https://www.linkedin.com/in/their-name" value={person.linkedin} onChange={(event) => update("linkedin", event.target.value)} />
                )}
              </Field>
              <Field label={`Why you'd like to meet ${targetFirst ?? "them"}`}
                hint={`Say who you are and why ${targetFirst ?? "this person"}. ${connectorFirst} forwards it as it is.`}>
                {({ id, hintId }) => (
                  <Textarea id={id} rows={5} required maxLength={noteRoom} value={why} aria-describedby={hintId} onChange={(event) => setWhy(event.target.value)} />
                )}
              </Field>
              <p className="type-small flex gap-2.5 text-foreground-soft">
                <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>{targetName ? readIntroPromise(connectorName, targetName) : `${connectorFirst} reads your note first. The person you name hears nothing unless they say yes.`}</span>
              </p>
              <FormError message={ask.error?.message ?? null} />
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button type="submit" size="lg" disabled={ask.isPending} className="sm:flex-1">
                  {ask.isPending ? "Sending…" : `Send to ${connectorFirst}`}
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
