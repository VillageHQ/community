"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Send } from "lucide-react";
import { useRef, useState } from "react";

import { FormError } from "@/components/form-error";
import { TextareaField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  BULK_INVITE_FORMATS,
  MAXIMUM_CSV_BYTES,
  MAXIMUM_CSV_ROWS,
  MAXIMUM_LISTED_INVITES,
  toCsv,
  type BulkInviteFormat,
  type BulkInviteResult,
} from "@/modules/members/contract-bulk-invites";
import { INVITE_LIFETIME_DAYS } from "@/modules/members/contract-invite-state";
import { createBulkInvitesRequest, INVITE_QUERY_KEYS } from "@/modules/members/queries-invites";

const LIST_FIELD = "people";
const FILE_FIELD = "invite-file";
const LIST_PLACEHOLDER = "Amara Okafor, amara@example.com\nJonas Berg <jonas@example.com>\nlee@example.com";
const TOO_LARGE_MESSAGE = "This file is over 8 MB. Split it and upload each part.";
const OPEN_LIST_LIMIT = 10;

function plural(count: number, one: string, many: string) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

function downloadLinks(links: BulkInviteResult["links"]) {
  const csv = toCsv([["name", "email", "invite link"], ...links.map(({ name, email, link }) => [name ?? "", email, link])]);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "invite-links.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

type LineItem = { line: number; label: string; why: string };

function LineList({ title, items }: { title: string; items: LineItem[] }) {
  if (items.length === 0) return null;
  return (
    <details className="rounded-field bg-muted px-4 py-3" open={items.length <= OPEN_LIST_LIMIT}>
      <summary className="type-small cursor-pointer font-bold">{title}</summary>
      <ul className="type-small mt-2 grid max-h-72 gap-1.5 overflow-y-auto text-foreground-soft">
        {items.map(({ line, label, why }) => (
          <li key={`${line}-${label}`} className="wrap-anywhere">
            <span className="font-semibold text-foreground">Line {line}</span>
            {label ? ` · ${label}` : null} · {why}
          </li>
        ))}
      </ul>
    </details>
  );
}

function describeDelivery(result: BulkInviteResult) {
  if (result.invitedCount + result.renewedCount === 0) return "";
  return result.isEmailOn
    ? ` We're emailing each person their own link. It works once and lasts ${INVITE_LIFETIME_DAYS} days.`
    : ` Email is off, so download the links and send each person theirs. Each works once and lasts ${INVITE_LIFETIME_DAYS} days.`;
}

export function BulkInviteResultPanel({ result }: { result: BulkInviteResult }) {
  const summary = [
    plural(result.invitedCount, "person invited", "people invited"),
    result.renewedCount > 0 ? plural(result.renewedCount, "expired invite renewed", "expired invites renewed") : null,
    `${result.skipped.length.toLocaleString("en-US")} skipped`,
    plural(result.problems.length, "problem", "problems"),
  ].filter(Boolean);
  return (
    <div className="grid gap-3">
      <Alert variant={result.invitedCount + result.renewedCount > 0 ? "success" : "info"}>
        {summary.join(" · ")}.{describeDelivery(result)}
      </Alert>
      {result.links.length > 0 ? (
        <div>
          <Button type="button" variant="outline" onClick={() => downloadLinks(result.links)} className="max-sm:w-full">
            <Download aria-hidden="true" />
            Download {plural(result.links.length, "link", "links")} (CSV)
          </Button>
        </div>
      ) : null}
      <LineList title={`Problems (${result.problems.length})`} items={result.problems.map(({ line, text, why }) => ({ line, label: text, why }))} />
      <LineList title={`Skipped (${result.skipped.length})`} items={result.skipped.map(({ line, email, why }) => ({ line, label: email, why }))} />
    </div>
  );
}

export function BulkInviteForm({ isEmailConfigured }: { isEmailConfigured: boolean }) {
  const queryClient = useQueryClient();
  const listRef = useRef<HTMLFormElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const bulkMutation = useMutation({
    mutationFn: ({ format, body }: { format: BulkInviteFormat; body: string | Blob }) => createBulkInvitesRequest(format, body),
    onSuccess: () => {
      listRef.current?.reset();
      return queryClient.invalidateQueries({ queryKey: [INVITE_QUERY_KEYS.list] });
    },
  });

  function submitFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (file.size > MAXIMUM_CSV_BYTES) {
      setFileError(TOO_LARGE_MESSAGE);
      return;
    }
    bulkMutation.mutate({ format: BULK_INVITE_FORMATS.csv, body: file });
  }

  return (
    <div className="grid gap-5">
      <form
        ref={listRef}
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setFileError(null);
          const text = String(new FormData(event.currentTarget).get(LIST_FIELD) ?? "");
          bulkMutation.mutate({ format: BULK_INVITE_FORMATS.list, body: text });
        }}
      >
        <TextareaField
          name={LIST_FIELD}
          label="Paste a list"
          rows={5}
          placeholder={LIST_PLACEHOLDER}
          hint={`One person per line: "Name, email", "Name <email>" or just the email. Up to ${MAXIMUM_LISTED_INVITES} at once.`}
          required
        />
        <Button type="submit" size="lg" disabled={bulkMutation.isPending} className="max-sm:w-full sm:justify-self-start">
          <Send aria-hidden="true" />
          {bulkMutation.isPending ? "Inviting…" : isEmailConfigured ? "Send the invites" : "Create the invites"}
        </Button>
      </form>
      <div className="grid gap-2">
        <Label htmlFor={FILE_FIELD}>Or upload a CSV file</Label>
        <p className="type-small text-muted-foreground">
          Columns name and email, and optionally company and cohort, under a header row. Up to {MAXIMUM_CSV_ROWS.toLocaleString("en-US")} rows or 8 MB.
        </p>
        <div>
          <input
            id={FILE_FIELD}
            type="file"
            accept=".csv,text/csv"
            disabled={bulkMutation.isPending}
            className="type-small max-w-full file:mr-3 file:inline-flex file:cursor-pointer file:items-center file:rounded-full file:border file:border-border file:bg-card file:px-4 file:py-2 file:font-semibold file:text-foreground"
            onChange={(event) => {
              submitFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>
      <FormError message={fileError ?? bulkMutation.error?.message ?? null} />
      {bulkMutation.data ? <BulkInviteResultPanel result={bulkMutation.data} /> : null}
    </div>
  );
}
