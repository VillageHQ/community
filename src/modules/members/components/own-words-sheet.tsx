"use client";

import { useMutation } from "@tanstack/react-query";
import { cn } from "cn";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { useFlash } from "@/components/flash";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SourceBadge } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { OWN_FIELD_KEYS, type OwnFieldKey } from "@/modules/members/contract-own-words";


// Founderhall's "In your own words" (member-me-profile, member-me-edit-field): one ruled block per field with its
// source ("you" or "from public profiles") and an Edit link; Edit opens that one field in place, Save or Cancel.

export type OwnField = {
  key: OwnFieldKey;
  label: string;
  // The member's own words, or "" when they wrote none.
  ownValue: string;
  // What shows when they wrote none: a line filled in from public profiles.
  filledValue: string | null;
  isLong?: boolean;
  isSerif?: boolean;
  maxLength: number;
  hint?: string;
};

// Which field of the profile body each block saves.
const BODY_KEY_OF: Record<OwnFieldKey, string> = {
  name: "name",
  role: "title",
  company: "company",
  city: "location",
  stage: "stage",
  sector: "sector",
  cohort: "cohort",
  working_on: "bio",
  can_help_with: "canHelpWith",
  looking_for: "needs",
  tags: "tags",
  linkedin: "linkedinUrl",
  website: "website",
};

function toBody(key: OwnFieldKey, value: string) {
  if (key === OWN_FIELD_KEYS.tags) {
    return { tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) };
  }
  return { [BODY_KEY_OF[key]]: value };
}

function saveField({ key, value }: { key: OwnFieldKey; value: string }) {
  return postRequest(API_ROUTES.profile, toBody(key, value), acknowledgedResponseSchema);
}

function FieldEditor({ field, onDone }: { field: OwnField; onDone: () => void }) {
  const router = useRouter();
  const flash = useFlash();
  const [value, setValue] = useState(field.ownValue);
  const control = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const save = useMutation({
    mutationFn: saveField,
    onSuccess: () => {
      flash("Saved.");
      onDone();
      router.replace(ROUTES.editCard, { scroll: false });
      router.refresh();
    },
  });
  useEffect(() => control.current?.focus(), []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate({ key: field.key, value });
  }

  return (
    <form className="fh-edit block" onSubmit={submit}>
      {field.isLong ? (
        <Textarea
          ref={control}
          value={value}
          maxLength={field.maxLength}
          aria-label={field.label}
          className="min-h-[84px]"
          onChange={(event) => setValue(event.target.value)}
        />
      ) : (
        <Input ref={control} value={value} maxLength={field.maxLength} aria-label={field.label} onChange={(event) => setValue(event.target.value)} />
      )}
      {field.hint ? <p className="fh-hint">{field.hint}</p> : null}
      <FormError message={save.error?.message ?? null} />
      <div className="fh-btn-row mt-2">
        <Button type="submit" variant="primary" size="sm" disabled={save.isPending}>
          Save
        </Button>
        <Button asChild variant="quiet" size="sm">
          <Link
            href={ROUTES.editCard}
            scroll={false}
            onClick={(event) => {
              event.preventDefault();
              onDone();
              router.replace(ROUTES.editCard, { scroll: false });
            }}
          >
            Cancel
          </Link>
        </Button>
      </div>
    </form>
  );
}

function FieldRow({ field, isEditing, onEdit, onDone }: { field: OwnField; isEditing: boolean; onEdit: () => void; onDone: () => void }) {
  const shownValue = field.ownValue || field.filledValue;
  const source = field.ownValue ? "you" : field.filledValue ? "village" : null;
  return (
    <div className={cn("fh-fieldblock", isEditing && "fh-editing")} id={`f-${field.key}`}>
      <div className="fh-k">
        <span>
          {field.label} {source ? <SourceBadge source={source} /> : null}
        </span>
        <Button asChild variant="quiet" size="sm">
          <Link
            href={`${ROUTES.editCard}?edit=${field.key}#f-${field.key}`}
            scroll={false}
            aria-label={`Edit ${field.label.toLowerCase()}`}
            onClick={(event) => {
              event.preventDefault();
              onEdit();
            }}
          >
            <Pencil aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
            Edit
          </Link>
        </Button>
      </div>
      <p className={cn("fh-v whitespace-pre-line wrap-anywhere", field.isSerif && "fh-serif")}>{shownValue ? shownValue : <span className="fh-muted">Not filled in</span>}</p>
      {isEditing ? <FieldEditor field={field} onDone={onDone} /> : null}
    </div>
  );
}

export function OwnWordsSheet({ fields, isFillInOn, communityName }: { fields: readonly OwnField[]; isFillInOn: boolean; communityName: string }) {
  const searchParams = useSearchParams();
  const asked = searchParams.get("edit");
  const [editing, setEditing] = useState<string | null>(asked);
  // A Correct link (?edit=role) opens that field, also when the page is already open.
  const [lastAsked, setLastAsked] = useState(asked);
  if (asked !== lastAsked) {
    setLastAsked(asked);
    setEditing(asked);
  }
  return (
    <section className="fh-sheet" aria-label="In your own words">
      <div className="fh-source">
        <Pencil aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
        In your own words
      </div>
      {fields.map((field) => (
        <FieldRow key={field.key} field={field} isEditing={editing === field.key} onEdit={() => setEditing(field.key)} onDone={() => setEditing(null)} />
      ))}
      <p className="fh-small fh-muted mt-2">
        “you” marks your own words. Lines “from public profiles” are filled in{isFillInOn ? "" : ` once ${communityName} switches on profile fill-in`}; your own words always win.{" "}
        <Link href={ROUTES.yourData}>Your data</Link>
      </p>
    </section>
  );
}

