"use client";

import { useMutation } from "@tanstack/react-query";
import { RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FLASH_KINDS, useFlash } from "@/components/flash";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dnsCheckSchema, EMAIL_TEST_OUTCOMES, emailTestResultSchema } from "@/platform/email/dns-check-contract";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { MAIL_SETTINGS_API_ROUTE, type MailSettingsBody } from "@/modules/admin/contract-mail";

// Set up › Mail › DNS checklist's "Check DNS now": live lookups, kept on the server, so the page re-reads them.
export function CheckDnsButton() {
  const router = useRouter();
  const flash = useFlash();
  const check = useMutation({
    mutationFn: () => postRequest(API_ROUTES.adminEmailCheck, {}, dnsCheckSchema),
    onSuccess: () => {
      flash("DNS checked.");
      router.refresh();
    },
    onError: (error) => flash(error.message, { kind: FLASH_KINDS.needs }),
  });
  return (
    <Button type="button" variant="secondary" size="sm" disabled={check.isPending} onClick={() => check.mutate()}>
      <RefreshCw aria-hidden="true" strokeWidth={1.5} />
      {check.isPending ? "Checking…" : "Check DNS now"}
    </Button>
  );
}

type MailDnsSettingsProps = { saved: MailSettingsBody; defaultReplyDomain: string };

// Set up › Mail › DNS settings: the DKIM selector and the reply subdomain the check looks up, and a test to the admin.
export function MailDnsSettings({ saved, defaultReplyDomain }: MailDnsSettingsProps) {
  const router = useRouter();
  const flash = useFlash();
  const [values, setValues] = useState(saved);
  const save = useMutation({
    mutationFn: (body: MailSettingsBody) => postRequest(MAIL_SETTINGS_API_ROUTE, body, acknowledgedResponseSchema),
    onSuccess: () => {
      flash("Mail settings saved.");
      router.refresh();
    },
    onError: (error) => flash(error.message, { kind: FLASH_KINDS.needs }),
  });
  // Only ever to the admin's own address.
  const test = useMutation({
    mutationFn: () => postRequest(API_ROUTES.adminEmailTest, {}, emailTestResultSchema),
    onSuccess: ({ outcome, message }) => {
      flash(message, { kind: outcome === EMAIL_TEST_OUTCOMES.sent ? FLASH_KINDS.ok : FLASH_KINDS.needs });
      router.refresh();
    },
    onError: (error) => flash(error.message, { kind: FLASH_KINDS.needs }),
  });

  return (
    <section className="fh-sheet">
      <h2 className="fh-h3">DNS settings</h2>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(values);
        }}
      >
        <Field htmlFor="m-dkim" label="DKIM selector" hint="The part before ._domainkey in the record your mail service shows." className="fh-field">
          <Input
            id="m-dkim"
            name="dkim_selector"
            className="fh-mono"
            value={values.dkimSelector}
            maxLength={63}
            placeholder="e.g. resend"
            aria-describedby="m-dkim-hint"
            onChange={(event) => setValues((current) => ({ ...current, dkimSelector: event.target.value }))}
          />
        </Field>
        <Field
          htmlFor="m-reply"
          label="Reply subdomain"
          hint={
            <>
              Empty: {defaultReplyDomain}. The sending domain itself is in <Link href={`${ROUTES.adminSettings}#mail`}>Settings</Link>.
            </>
          }
          className="fh-field"
        >
          <Input
            id="m-reply"
            name="reply_domain"
            className="fh-mono"
            value={values.replyDomain}
            maxLength={120}
            placeholder={defaultReplyDomain}
            aria-describedby="m-reply-hint"
            onChange={(event) => setValues((current) => ({ ...current, replyDomain: event.target.value }))}
          />
        </Field>
        <Button type="submit" size="sm" disabled={save.isPending}>
          Save
        </Button>
      </form>
      <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={test.isPending} onClick={() => test.mutate()}>
        <Send aria-hidden="true" strokeWidth={1.5} />
        {test.isPending ? "Sending…" : "Send a test to me"}
      </Button>
    </section>
  );
}
