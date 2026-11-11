"use client";

import { useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState } from "react";

import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { Textarea } from "@/components/ui/textarea";
import { PARTNER_REPORT_LIMITS } from "@/modules/admin/contract-partner-report";
import type { ConsolePeriodParam } from "@/modules/admin/console-periods";
import { sendPartnerReportRequest } from "@/modules/admin/queries-partner-report";

function readSentMessage(queued: number, skipped: readonly string[]) {
  const sent = queued === 1 ? "Sent to 1 partner." : `Sent to ${queued} partners.`;
  if (skipped.length === 0) return sent;
  return `${sent} Skipped ${skipped.join(", ")}: email to ${skipped.length === 1 ? "that address" : "those addresses"} bounced or was marked as spam before.`;
}

type PartnerSendFormProps = {
  period: ConsolePeriodParam;
  savedRecipients: readonly string[];
  // The email as partners get it, without a line on top; the line the admin types goes above it.
  fromName: string;
  subject: string;
  text: string;
};

// Founderhall's Send to partners: the form (addresses, a line on top) and the plain email beside it.
export function PartnerSendForm({ period, savedRecipients, fromName, subject, text }: PartnerSendFormProps) {
  const [recipients, setRecipients] = useState(savedRecipients.join(", "));
  const [note, setNote] = useState("");
  const send = useMutation({ mutationFn: () => sendPartnerReportRequest({ recipients, note, period }) });
  const line = note.trim();
  const error = send.error?.message ?? null;

  return (
    <>
      {send.data ? (
        <Note kind="ok" role="status" className="mb-4">
          {readSentMessage(send.data.queued, send.data.skipped)}
        </Note>
      ) : null}
      <div className="fh-grid">
        <form
          className="fh-sheet fh-c7"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            send.mutate();
          }}
        >
          <Field htmlFor="p-emails" label="Partners’ emails" hint={error ? undefined : `Saved for next time. Up to ${PARTNER_REPORT_LIMITS.recipients} addresses.`} error={error}>
            <Textarea
              id="p-emails"
              name="emails"
              rows={3}
              placeholder="e.g. partner@fund.example, partner2@fund.example"
              value={recipients}
              aria-invalid={error ? true : undefined}
              onChange={(event) => {
                setRecipients(event.target.value);
                send.reset();
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field htmlFor="p-note" label="A line on top (optional)" className="mt-3.5">
            <Textarea
              id="p-note"
              name="note"
              rows={3}
              maxLength={PARTNER_REPORT_LIMITS.noteLength}
              placeholder="e.g. Here is this quarter’s intro report."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <div className="fh-btn-row mt-3.5">
            <Button type="submit" disabled={send.isPending}>
              <Send aria-hidden="true" strokeWidth={1.5} />
              Send the report
            </Button>
          </div>
        </form>
        <section className="fh-c5">
          <div className="fh-mail">
            <div className="fh-mail-h">
              <div>
                <span className="fh-k">From</span>
                <span className="fh-v">{fromName}</span>
              </div>
              <div className="fh-subj">{subject}</div>
            </div>
            <div className="fh-mail-b">
              <pre className="fh-mailtext">{line ? `${line}\n\n${text}` : text}</pre>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
