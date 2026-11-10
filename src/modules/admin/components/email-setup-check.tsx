"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { DNS_CHECK_STATUSES, dnsCheckSchema, emailTestResultSchema, type DnsCheckLine } from "@/platform/email/dns-check-contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

const STATUS_TAGS = {
  [DNS_CHECK_STATUSES.ok]: { tone: "sage", icon: CircleCheck, text: "Found" },
  [DNS_CHECK_STATUSES.missing]: { tone: "destructive", icon: CircleAlert, text: "Missing" },
  [DNS_CHECK_STATUSES.unknown]: { tone: "gold", icon: CircleHelp, text: "No answer" },
} as const;

function CheckLine({ line }: { line: DnsCheckLine }) {
  const { tone, icon: Icon, text } = STATUS_TAGS[line.status];
  return (
    <li className="grid gap-2 rounded-field bg-muted px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">{line.label}</span>
        <Tag tone={tone}>
          <Icon aria-hidden="true" />
          {text}
        </Tag>
      </div>
      <p className="type-small wrap-anywhere text-foreground-soft">{line.found}</p>
      {line.toAdd ? (
        <div className="grid gap-2">
          <p className="type-small font-bold">Add this record where you manage the domain:</p>
          <dl className="type-small grid gap-1 rounded-field bg-card px-3 py-2 font-mono">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{line.toAdd.type}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="wrap-anywhere">{line.toAdd.name}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Value</dt>
              <dd className="wrap-anywhere">{line.toAdd.value}</dd>
            </div>
          </dl>
          <div>
            <CopyButton text={line.toAdd.value} label={`Copy the ${line.label} value`} />
          </div>
        </div>
      ) : null}
    </li>
  );
}

// The sending domain's records, looked up live, and a test email to the admin's own address.
export function EmailSetupCheck() {
  const check = useMutation({ mutationFn: () => postRequest(API_ROUTES.adminEmailCheck, {}, dnsCheckSchema) });
  const test = useMutation({ mutationFn: () => postRequest(API_ROUTES.adminEmailTest, {}, emailTestResultSchema) });
  const missing = check.data?.lines.filter(({ status }) => status !== DNS_CHECK_STATUSES.ok).length ?? 0;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={check.isPending} onClick={() => check.mutate()} className="max-sm:w-full">
          {check.isPending ? "Checking…" : check.data ? "Check again" : "Check the domain"}
        </Button>
        <Button variant="outline" disabled={test.isPending} onClick={() => test.mutate()} className="max-sm:w-full">
          {test.isPending ? "Sending…" : "Send a test to me"}
        </Button>
      </div>
      {test.isSuccess ? <Alert variant={test.data.outcome === "email_off" ? "info" : "success"}>{test.data.message}</Alert> : null}
      <FormError message={test.error?.message ?? check.error?.message ?? null} />
      {check.data ? (
        <div className="grid gap-2" aria-live="polite">
          <p className="type-small text-foreground-soft">
            {missing === 0
              ? `${check.data.domain} has every record Resend needs.`
              : `${check.data.domain}: ${missing === 1 ? "1 record needs" : `${missing} records need`} your attention. Changes can take an hour to show.`}
          </p>
          <ul className="grid gap-2">
            {check.data.lines.map((line) => (
              <CheckLine key={line.key} line={line} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
