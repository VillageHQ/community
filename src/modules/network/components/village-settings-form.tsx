"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  INTRODUCER_RULES,
  SEARCH_SCOPES,
  type IntroducerRule,
  type SearchScope,
  type VillageSettingsBody,
} from "@/modules/network/contract-village-settings";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

const OPTION_CLASSES =
  "flex items-start gap-3.5 rounded-field px-card-phone py-3 shadow-[inset_0_0_0_1.5px_var(--input)] has-checked:shadow-[inset_0_0_0_2.5px_var(--brand-emphasis)]";
const CONTROL_CLASSES = "mt-1 size-5 shrink-0 accent-[var(--brand-emphasis)]";

const SCOPE_CHOICES: { value: SearchScope; title: string; description: string }[] = [
  { value: SEARCH_SCOPES.network, title: "Members' networks", description: "Searches show people members know. The default." },
  { value: SEARCH_SCOPES.everyone, title: "Everyone", description: "Searches also show people beyond the members' networks. Paths still only go through members who share." },
];

const INTRODUCER_CHOICES: { value: IntroducerRule; title: string; description: string }[] = [
  { value: INTRODUCER_RULES.allSharing, title: "Every member who shares their network", description: "Any of them can be asked for an intro. The default." },
  { value: INTRODUCER_RULES.chosen, title: "Only members you choose", description: "Paths through other members are left out, and only the chosen can offer intros." },
];

type SharingMember = { id: string; name: string };

type VillageSettingsFormProps = { settings: VillageSettingsBody; sharingMembers: SharingMember[]; defaultServiceEmail: string | null };

function Option({ children, ...input }: { children: ReactNode; name: string; value: string; checked: boolean; onChange: () => void; type?: "radio" | "checkbox" }) {
  return (
    <label className={OPTION_CLASSES}>
      <input type={input.type ?? "radio"} name={input.name} value={input.value} checked={input.checked} onChange={input.onChange} className={CONTROL_CLASSES} />
      <span className="grid gap-0.5">{children}</span>
    </label>
  );
}

function saveSettings(body: VillageSettingsBody) {
  return postRequest(API_ROUTES.villageSettings, body, acknowledgedResponseSchema);
}

export function VillageSettingsForm({ settings, sharingMembers, defaultServiceEmail }: VillageSettingsFormProps) {
  const router = useRouter();
  const [searchScope, setSearchScope] = useState(settings.searchScope);
  const [introducers, setIntroducers] = useState(settings.introducers);
  const [chosen, setChosen] = useState(new Set(settings.chosenIntroducerIds));
  const [serviceEmail, setServiceEmail] = useState(settings.serviceEmail);
  const save = useMutation({ mutationFn: saveSettings, onSuccess: () => router.refresh() });

  function toggle(id: string) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ searchScope, introducers, chosenIntroducerIds: [...chosen], serviceEmail });
      }}
    >
      <fieldset className="grid gap-2.5">
        <legend className="type-label mb-2">Where member searches look</legend>
        {SCOPE_CHOICES.map(({ value, title, description }) => (
          <Option key={value} name="searchScope" value={value} checked={searchScope === value} onChange={() => setSearchScope(value)}>
            <span className="font-bold">{title}</span>
            <span className="type-small text-foreground-soft">{description}</span>
          </Option>
        ))}
      </fieldset>
      <fieldset className="grid gap-2.5">
        <legend className="type-label mb-2">Who can introduce</legend>
        {INTRODUCER_CHOICES.map(({ value, title, description }) => (
          <Option key={value} name="introducers" value={value} checked={introducers === value} onChange={() => setIntroducers(value)}>
            <span className="font-bold">{title}</span>
            <span className="type-small text-foreground-soft">{description}</span>
          </Option>
        ))}
      </fieldset>
      {introducers === INTRODUCER_RULES.chosen ? (
        <fieldset className="grid gap-2">
          <legend className="type-label mb-2">Members who can introduce</legend>
          {sharingMembers.length === 0 ? (
            <p className="type-small text-foreground-soft">No member shares their network yet. Members show here once they join the group.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {sharingMembers.map(({ id, name }) => (
                <Option key={id} type="checkbox" name="chosenIntroducerIds" value={id} checked={chosen.has(id)} onChange={() => toggle(id)}>
                  <span className="font-bold">{name}</span>
                </Option>
              ))}
            </div>
          )}
        </fieldset>
      ) : null}
      <FormField
        name="serviceEmail"
        label="Service email"
        type="email"
        value={serviceEmail}
        onChange={(event) => setServiceEmail(event.target.value)}
        placeholder={defaultServiceEmail ?? "village@example.com"}
        hint={`The address Village sees for this community's own lookups, like filling in cards. Leave it empty to use the first admin's${defaultServiceEmail ? ` (${defaultServiceEmail})` : ""}.`}
      />
      <FormError message={save.error?.message ?? null} />
      {save.isSuccess ? <Alert variant="success">{save.data.message}</Alert> : null}
      <Button type="submit" disabled={save.isPending} className="max-sm:w-full sm:justify-self-start">
        {save.isPending ? "Saving…" : "Save the Village settings"}
      </Button>
    </form>
  );
}
