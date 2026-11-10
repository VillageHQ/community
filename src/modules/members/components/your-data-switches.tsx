"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useId, type ReactNode } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { MESSAGE_POLICIES, type MessagePolicy, type PrivacyBody } from "@/modules/members/contract-privacy";
import { saveLookupChoice } from "@/modules/members/components/lookup-question-card";

export type YourDataSwitchesProps = {
  isHidden: boolean;
  messagePolicy: MessagePolicy;
  acceptsIntroAsks: boolean | null;
  isMessagesOn: boolean;
  isIntrosOn: boolean;
  // Null when the community doesn't fill in profiles at all.
  lookup: { isAllowed: boolean } | null;
  // Null when network search is off.
  sharing: { isSharing: boolean; since: string | null } | null;
};

function savePrivacyChange(change: PrivacyBody) {
  return postRequest(API_ROUTES.profilePrivacy, change, acknowledgedResponseSchema);
}

function SwitchRow({ title, hint, isOn, isPending, onChange }: { title: string; hint: string; isOn: boolean; isPending: boolean; onChange: (isOn: boolean) => void }) {
  const labelId = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="grid min-w-0 gap-0.5">
        <span id={labelId} className="font-bold">
          {title}
        </span>
        <span className="type-small text-foreground-soft">{hint}</span>
      </div>
      <Switch aria-labelledby={labelId} checked={isOn} disabled={isPending} onCheckedChange={onChange} />
    </div>
  );
}

function ChoiceGroup<Value extends string>({
  legend,
  hint,
  name,
  value,
  options,
  isPending,
  onChange,
}: {
  legend: string;
  hint?: ReactNode;
  name: string;
  value: Value | null;
  options: { value: Value; label: string; hint: string }[];
  isPending: boolean;
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset className="grid gap-2 py-3">
      <legend className="font-bold">{legend}</legend>
      {hint ? <p className="type-small text-foreground-soft">{hint}</p> : null}
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-field bg-muted p-3 has-[:checked]:shadow-[inset_0_0_0_2px_var(--ring)]">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={isPending}
            onChange={() => onChange(option.value)}
            className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
          />
          <span className="grid gap-0.5">
            <span className="font-semibold">{option.label}</span>
            <span className="type-small text-foreground-soft">{option.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

const INTRO_ASKS_YES = "yes";
const INTRO_ASKS_NO = "no";

export function YourDataSwitches({ isHidden, messagePolicy, acceptsIntroAsks, isMessagesOn, isIntrosOn, lookup, sharing }: YourDataSwitchesProps) {
  const router = useRouter();
  const privacy = useMutation({ mutationFn: savePrivacyChange, onSuccess: () => router.refresh() });
  const lookupChoice = useMutation({ mutationFn: saveLookupChoice, onSuccess: () => router.refresh() });
  const isPending = privacy.isPending || lookupChoice.isPending;
  const introAsksValue = acceptsIntroAsks === null ? null : acceptsIntroAsks ? INTRO_ASKS_YES : INTRO_ASKS_NO;

  return (
    <section aria-labelledby="switches-title" className="grid gap-1 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
      <h2 id="switches-title" className="type-h3">
        Your switches
      </h2>
      <p className="type-small text-foreground-soft">Each one saves as you change it.</p>
      <div className="grid divide-y divide-border">
        <SwitchRow
          title="Hide me from the directory"
          hint="Members can't find you in Members or its search, or open your profile. Admins still see you."
          isOn={isHidden}
          isPending={isPending}
          onChange={(isOn) => privacy.mutate({ isHidden: isOn })}
        />
        {isMessagesOn ? (
          <ChoiceGroup
            legend="Who can message me"
            name="message-policy"
            value={messagePolicy}
            isPending={isPending}
            onChange={(value) => privacy.mutate({ messagePolicy: value })}
            options={[
              { value: MESSAGE_POLICIES.anyone, label: "Anyone in the community", hint: "Any member can start a conversation with you." },
              {
                value: MESSAGE_POLICIES.introduced,
                label: "Only people I was introduced to",
                hint: "Members you met through an intro here. Admins can always write, and you can always answer someone you wrote to.",
              },
            ]}
          />
        ) : null}
        {isIntrosOn ? (
          <ChoiceGroup
            legend="Accept intro asks"
            hint={acceptsIntroAsks === null ? "You haven't answered yet, so members can still ask you." : undefined}
            name="intro-asks"
            value={introAsksValue}
            isPending={isPending}
            onChange={(value) => privacy.mutate({ acceptsIntroAsks: value === INTRO_ASKS_YES })}
            options={[
              { value: INTRO_ASKS_YES, label: "Yes, members can ask me", hint: "A member can ask you to introduce them to someone you know. You say yes or no to each ask." },
              { value: INTRO_ASKS_NO, label: "No, don't send me intro asks", hint: "Nobody can ask you to make an intro." },
            ]}
          />
        ) : null}
        {lookup ? (
          <SwitchRow
            title="Don't look me up on public profiles"
            hint="Stops filling in your card from public profiles, and deletes what it found. Your own words stay."
            isOn={!lookup.isAllowed}
            isPending={isPending}
            onChange={(isOn) => lookupChoice.mutate(!isOn)}
          />
        ) : null}
        {sharing ? (
          <div className="flex flex-wrap items-start justify-between gap-4 py-3">
            <div className="grid min-w-0 gap-0.5">
              <span className="font-bold">Share my network</span>
              <span className="type-small text-foreground-soft">
                {sharing.isSharing
                  ? `On${sharing.since ? ` since ${sharing.since}` : ""}: members see that you can introduce them, and can ask. You can leave the group on Network.`
                  : "Off: your network isn't shared with the community. You can join on Network."}
              </span>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={ROUTES.network}>Open Network</Link>
            </Button>
          </div>
        ) : null}
      </div>
      <FormError message={privacy.error?.message ?? lookupChoice.error?.message ?? null} />
    </section>
  );
}
