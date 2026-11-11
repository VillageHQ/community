"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { useFlash } from "@/components/flash";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { SetRow } from "@/components/ui/rows";
import { Switch } from "@/components/ui/switch";
import { EMAIL_TOPICS, type EmailTopic } from "@/platform/email/kinds";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

const preferenceSchema = z.object({ topic: z.enum(Object.values(EMAIL_TOPICS)), isOn: z.boolean() });

export type EmailSettingRow = { topic: EmailTopic; title: string; description: string; isOn: boolean };

async function saveChanges(changes: readonly { topic: EmailTopic; isOn: boolean }[]) {
  for (const change of changes) await postRequest(API_ROUTES.emailPreferences, change, preferenceSchema);
}

// Founderhall's Email settings (member-me-email): one row per email the member can switch off, and one Save.
export function EmailSettingsForm({ rows }: { rows: readonly EmailSettingRow[] }) {
  const router = useRouter();
  const flash = useFlash();
  const [choices, setChoices] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map(({ topic, isOn }) => [topic, isOn])));
  const save = useMutation({
    mutationFn: saveChanges,
    onSuccess: () => {
      flash("Email settings saved.");
      router.refresh();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate(rows.filter(({ topic, isOn }) => choices[topic] !== isOn).map(({ topic }) => ({ topic, isOn: choices[topic] ?? true })));
  }

  return (
    <form className="fh-sheet" onSubmit={submit} aria-label="Email settings">
      {rows.map(({ topic, title, description }) => (
        <SetRow
          key={topic}
          htmlFor={`email-topic-${topic}`}
          label={title}
          hint={description}
          control={<Switch id={`email-topic-${topic}`} checked={choices[topic] ?? true} onCheckedChange={(isOn) => setChoices((current) => ({ ...current, [topic]: isOn }))} />}
        />
      ))}
      <FormError message={save.error?.message ?? null} />
      <div className="fh-btn-row mt-3">
        <Button type="submit" variant="primary" size="sm" disabled={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
