"use client";

import { useMutation } from "@tanstack/react-query";
import { Eye, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TextareaField } from "@/components/form-field";
import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PARTNER_REPORT_LIMITS } from "@/modules/admin/contract-partner-report";
import { previewPartnerReportRequest, sendPartnerReportRequest } from "@/modules/admin/queries-partner-report";

const ADDRESS_SEPARATORS = /[\s,;]+/;

function countAddresses(text: string) {
  return new Set(text.split(ADDRESS_SEPARATORS).filter(Boolean).map((address) => address.toLowerCase())).size;
}

function readSentMessage(queued: number, skipped: readonly string[]) {
  const sent = queued === 1 ? "Sent to 1 partner." : `Sent to ${queued} partners.`;
  if (skipped.length === 0) return sent;
  return `${sent} Skipped ${skipped.join(", ")}: email to ${skipped.length === 1 ? "that address" : "those addresses"} bounced or was marked as spam before.`;
}

type PartnerSendCardProps = { savedRecipients: readonly string[]; isEmailConfigured: boolean };

export function PartnerSendCard({ savedRecipients, isEmailConfigured }: PartnerSendCardProps) {
  const router = useRouter();
  const [recipients, setRecipients] = useState(savedRecipients.join("\n"));
  const [note, setNote] = useState("");
  const preview = useMutation({ mutationFn: () => previewPartnerReportRequest(note) });
  const send = useMutation({
    mutationFn: () => sendPartnerReportRequest({ recipients, note }),
    onSuccess: () => router.refresh(),
  });
  const addressCount = countAddresses(recipients);
  const isTooMany = addressCount > PARTNER_REPORT_LIMITS.recipients;

  return (
    <Card data-print="hide" className="grid gap-4">
      <div className="grid gap-1.5">
        <CardTitle>Send to partners</CardTitle>
        <CardDescription>
          Email this report to up to {PARTNER_REPORT_LIMITS.recipients} people, like your fund&apos;s partners or sponsors. Each gets their own email. We remember the
          addresses for next time.
        </CardDescription>
      </div>
      {isEmailConfigured ? null : <Alert>Email is off on this site, so you can&apos;t send from here. Print the page or download the CSV instead.</Alert>}
      <TextareaField
        name="partner-recipients"
        label="Email addresses"
        hint={`One per line, or separated by commas. ${addressCount} of ${PARTNER_REPORT_LIMITS.recipients}.`}
        value={recipients}
        onChange={(event) => {
          setRecipients(event.target.value);
          send.reset();
        }}
        aria-invalid={isTooMany || undefined}
        rows={4}
        placeholder="partner@example.com"
        autoComplete="off"
        spellCheck={false}
      />
      <TextareaField
        name="partner-note"
        label="A note (optional)"
        hint="It goes at the top of the email."
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          preview.reset();
          send.reset();
        }}
        maxLength={PARTNER_REPORT_LIMITS.noteLength}
        rows={3}
      />
      <FormError
        message={
          isTooMany ? `Send to at most ${PARTNER_REPORT_LIMITS.recipients} addresses at a time. Remove ${addressCount - PARTNER_REPORT_LIMITS.recipients}.` : (preview.error?.message ?? send.error?.message ?? null)
        }
      />
      {send.data ? <Alert variant="success">{readSentMessage(send.data.queued, send.data.skipped)}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={preview.isPending} onClick={() => preview.mutate()}>
          <Eye aria-hidden="true" />
          {preview.data ? "Refresh preview" : "Preview the email"}
        </Button>
        <Button type="button" disabled={!isEmailConfigured || send.isPending || addressCount === 0 || isTooMany || Boolean(send.data)} onClick={() => send.mutate()}>
          <Send aria-hidden="true" />
          {send.isPending ? "Sending…" : addressCount === 1 ? "Send to 1 partner" : `Send to ${addressCount} partners`}
        </Button>
      </div>
      {preview.data ? (
        <div className="grid gap-2">
          <p className="type-small text-foreground-soft">
            Subject: <span className="font-bold text-foreground">{preview.data.subject}</span>
          </p>
          <iframe title="Email preview" sandbox="" srcDoc={preview.data.html} className="h-[560px] w-full rounded-field border border-border bg-white" />
        </div>
      ) : null}
    </Card>
  );
}
