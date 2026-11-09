"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

import { FormError } from "@/components/form-error";
import { Switch } from "@/components/ui/switch";
import { EMAIL_TOPIC_LABELS, EMAIL_TOPICS, type EmailTopic } from "@/platform/email/kinds";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

const preferenceSchema = z.object({ topic: z.enum(Object.values(EMAIL_TOPICS)), isOn: z.boolean() });

type EmailTopicSetting = { topic: EmailTopic; isOn: boolean };

function TopicSwitch({ topic, isOn: initialIsOn }: EmailTopicSetting) {
  const [isOn, setIsOn] = useState(initialIsOn);
  const mutation = useMutation({
    mutationFn: (nextIsOn: boolean) => postRequest(API_ROUTES.emailPreferences, { topic, isOn: nextIsOn }, preferenceSchema),
    onSuccess: (saved) => setIsOn(saved.isOn),
  });
  const { title, description } = EMAIL_TOPIC_LABELS[topic];
  const labelId = `email-topic-${topic}`;
  return (
    <li className="grid gap-2">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-0.5">
          <span id={labelId} className="font-bold">
            {title}
          </span>
          <span className="type-small text-foreground-soft">{description}</span>
        </div>
        <Switch
          aria-labelledby={labelId}
          checked={mutation.isPending ? mutation.variables : isOn}
          disabled={mutation.isPending}
          onCheckedChange={(checked) => mutation.mutate(checked)}
        />
      </div>
      <FormError message={mutation.error?.message ?? null} />
    </li>
  );
}

export function EmailPreferencesCard({ settings }: { settings: readonly EmailTopicSetting[] }) {
  if (settings.length === 0) return null;
  return (
    <section aria-labelledby="email-preferences-title" className="mt-5 grid gap-4 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
      <div className="grid gap-1">
        <h2 id="email-preferences-title" className="type-h3">
          Email
        </h2>
        <p className="type-small text-foreground-soft">Choose what we email you about. Account emails, like password resets, always come.</p>
      </div>
      <ul className="grid gap-4">
        {settings.map((setting) => (
          <TopicSwitch key={setting.topic} {...setting} />
        ))}
      </ul>
    </section>
  );
}
