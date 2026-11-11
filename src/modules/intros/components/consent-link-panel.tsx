"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Mail, Send } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { CopyButton } from "@/components/copy-button";
import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConsentIssue, Intro } from "@/modules/intros/contract";
import { composeConsentNote } from "@/modules/intros/copy";
import { emailConsentLinkRequest, issuedConsentQuery, makeNewConsentLinkRequest } from "@/modules/intros/queries";
import { readFirstName } from "@/platform/design/avatar-identity";

function EmailLinkForm({ intro, consentIssue }: { intro: Intro; consentIssue: ConsentIssue }) {
  const emailId = useId();
  const hintId = useId();
  const [targetEmail, setTargetEmail] = useState(intro.suggestedTargetEmail ?? "");
  const targetFirst = readFirstName(intro.target.name);
  const requesterFirst = readFirstName(intro.requester.name);
  const send = useMutation({ mutationFn: () => emailConsentLinkRequest({ introId: intro.id, token: consentIssue.token, targetEmail }) });

  function submit(event: FormEvent) {
    event.preventDefault();
    send.mutate();
  }

  if (send.data) return <Alert variant="success">{send.data.message} They can answer from the email.</Alert>;

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-field bg-card p-4">
      <p className="type-label">Or let us email {targetFirst} for you</p>
      <Label htmlFor={emailId}>{targetFirst}&apos;s email</Label>
      <Input
        id={emailId}
        type="email"
        required
        autoComplete="off"
        value={targetEmail}
        aria-describedby={hintId}
        onChange={(event) => setTargetEmail(event.target.value)}
      />
      <p id={hintId} className="type-small text-muted-foreground">
        {intro.suggestedTargetEmail ? `${requesterFirst} gave this address. Check it before you send. ` : null}
        We use this address to ask {targetFirst} once, and to join them if they say yes. Then we delete it. Nobody else sees it.
      </p>
      <FormError message={send.error?.message ?? null} />
      <Button type="submit" size="lg" variant="soft" disabled={send.isPending}>
        <Mail aria-hidden="true" />
        {send.isPending ? "Sending…" : `Email ${targetFirst}`}
      </Button>
    </form>
  );
}

function IssuedConsent({ intro, consentIssue }: { intro: Intro; consentIssue: ConsentIssue }) {
  const consentNote = composeConsentNote(intro, consentIssue.link);
  return (
    <>
      <p className="type-body rounded-field bg-card p-4 wrap-anywhere whitespace-pre-wrap text-foreground">{consentNote}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={consentNote} label="Copy the note" />
        <CopyButton text={consentIssue.link} label="Copy just the link" />
      </div>
      <p className="type-small text-foreground-soft">This link is only for them. We only show it now, because we keep a scrambled copy.</p>
      {consentIssue.canEmailTarget ? <EmailLinkForm intro={intro} consentIssue={consentIssue} /> : null}
    </>
  );
}

function MakeNewLink({ intro }: { intro: Intro }) {
  const queryClient = useQueryClient();
  const makeLink = useMutation({
    mutationFn: () => makeNewConsentLinkRequest(intro.id),
    onSuccess: ({ consentIssue }) => queryClient.setQueryData(issuedConsentQuery(intro.id).queryKey, consentIssue),
  });
  return (
    <div className="grid gap-2">
      <p className="type-note text-foreground-soft">Lost the link? Make a new one. Any link you already sent keeps working until they answer.</p>
      <FormError message={makeLink.error?.message ?? null} />
      <div>
        <Button type="button" variant="outline" disabled={makeLink.isPending} onClick={() => makeLink.mutate()}>
          <Link2 aria-hidden="true" />
          {makeLink.isPending ? "Making it…" : "Make a new link"}
        </Button>
      </div>
    </div>
  );
}

export function ConsentLinkPanel({ intro }: { intro: Intro }) {
  const { data: consentIssue } = useQuery(issuedConsentQuery(intro.id));
  const targetFirst = readFirstName(intro.target.name);
  const requesterFirst = readFirstName(intro.requester.name);

  return (
    <div className="grid gap-3 rounded-field bg-accent p-4">
      <h3 className="type-h3 flex items-center gap-2">
        <Send aria-hidden="true" className="size-5 shrink-0 text-brand-emphasis" />
        Now ask {targetFirst}
      </h3>
      <p className="type-note text-foreground-soft">
        Send {targetFirst} this private link, however you normally reach them. They read {requesterFirst}&apos;s note and say yes or no thanks, with no account. {requesterFirst} hears nothing until then.
      </p>
      {consentIssue ? <IssuedConsent intro={intro} consentIssue={consentIssue} /> : <MakeNewLink intro={intro} />}
    </div>
  );
}
