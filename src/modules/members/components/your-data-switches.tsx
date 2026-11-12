"use client";

import { useMutation } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { useFlash } from "@/components/flash";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { OptionCard } from "@/components/ui/checkbox-card";
import { SetRow } from "@/components/ui/rows";
import { Switch } from "@/components/ui/switch";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { COMMUNITY_MESSAGE_POLICY, MESSAGE_POLICIES, type MessagePolicy } from "@/modules/members/contract-privacy";

import { saveLookupChoice } from "./lookup-question-card";

const NO_LOOKUP_ID = "switch-no-lookup";
const HIDDEN_ID = "switch-hidden";

const COMMUNITY_DEFAULT_WORDS: Record<string, string> = {
  [MESSAGE_POLICIES.anyone]: "anyone in the community",
  [MESSAGE_POLICIES.introduced]: "only people you were introduced to",
};

type SwitchesSheetProps = {
  communityName: string;
  isHidden: boolean;
  messagePolicy: MessagePolicy;
  // Null while messages are off: "Who can message me" is not offered.
  isMessagesOn: boolean;
  // Null when the community doesn't fill in profiles at all.
  lookup: { isAllowed: boolean } | null;
  // Community's own row, kept: dark mode on this device.
  deviceRow?: ReactNode;
};

async function saveSwitches({ privacy, allowsLookup }: { privacy: { isHidden: boolean; messagePolicy?: MessagePolicy }; allowsLookup: boolean | null }) {
  await postRequest(API_ROUTES.profilePrivacy, privacy, acknowledgedResponseSchema);
  if (allowsLookup !== null) await saveLookupChoice(allowsLookup);
}

// Founderhall's "Your switches" (member-me-data): don't look me up, hide me, who can message me, one Save.
export function SwitchesSheet({ communityName, isHidden, messagePolicy, isMessagesOn, lookup, deviceRow }: SwitchesSheetProps) {
  const router = useRouter();
  const flash = useFlash();
  const [noLookup, setNoLookup] = useState(lookup ? !lookup.isAllowed : false);
  const [hidden, setHidden] = useState(isHidden);
  const [policy, setPolicy] = useState<MessagePolicy>(messagePolicy);
  const save = useMutation({
    mutationFn: saveSwitches,
    onSuccess: () => {
      flash("Privacy settings saved.");
      router.refresh();
      // Founderhall comes back to the switches after a save.
      document.getElementById("switches")?.scrollIntoView({ block: "start" });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lookupChanged = lookup !== null && noLookup === lookup.isAllowed;
    save.mutate({
      privacy: { isHidden: hidden, ...(isMessagesOn && policy !== messagePolicy ? { messagePolicy: policy } : {}) },
      allowsLookup: lookupChanged ? !noLookup : null,
    });
  }

  const radio = (value: MessagePolicy, title: string, description: string) => (
    <OptionCard
      id={`dm-policy-${value}`}
      name="dm_policy"
      value={value}
      checked={policy === value}
      onChange={() => setPolicy(value)}
      title={title}
      description={description}
    />
  );

  return (
    <form className="fh-sheet" id="switches" aria-labelledby="switches-title" onSubmit={submit}>
      <h2 id="switches-title" className="fh-h3 flex items-center gap-1.5">
        <Settings2 aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} /> Your switches
      </h2>
      {lookup ? (
        <SetRow
          htmlFor={NO_LOOKUP_ID}
          label="Don’t look me up on public profiles"
          hint="Stops the fill-in for you and deletes what it found. Your own words stay. Search can then no longer name you as a path."
          control={<Switch id={NO_LOOKUP_ID} checked={noLookup} onCheckedChange={setNoLookup} />}
        />
      ) : null}
      <SetRow
        htmlFor={HIDDEN_ID}
        label="Hide me from the directory"
        hint="Members can’t find or open your profile. Admins still see you."
        control={<Switch id={HIDDEN_ID} checked={hidden} onCheckedChange={setHidden} />}
      />
      {isMessagesOn ? (
        <fieldset className="mt-3.5">
          <legend className="fh-label">Who can message me</legend>
          <div>
            {radio(MESSAGE_POLICIES.communityDefault, "The community’s default", `Now: ${COMMUNITY_DEFAULT_WORDS[COMMUNITY_MESSAGE_POLICY]}.`)}
            {radio(MESSAGE_POLICIES.anyone, `Anyone in ${communityName}`, "Any member can start a conversation.")}
            {radio(MESSAGE_POLICIES.introduced, "Only people I’ve been introduced to", "Members you met through an intro here. Admins can always write.")}
          </div>
        </fieldset>
      ) : null}
      <FormError message={save.error?.message ?? null} />
      <div className="fh-btn-row mt-3">
        <Button type="submit" variant="primary" size="sm" disabled={save.isPending}>
          Save
        </Button>
      </div>
      {deviceRow ? <div className="mt-3.5">{deviceRow}</div> : null}
    </form>
  );
}

function stopSharing() {
  return postRequest(API_ROUTES.networkLeave, { confirmed: true }, acknowledgedResponseSchema);
}

export type ShareState = { kind: "sharing" } | { kind: "connected" } | { kind: "not_connected" };

// Founderhall's "Share my network" row on Your data.
export function ShareNetworkSheet({ state }: { state: ShareState }) {
  const router = useRouter();
  const flash = useFlash();
  const leave = useMutation({
    mutationFn: stopSharing,
    onSuccess: () => {
      flash("Sharing is off. Your paths are gone from other members’ searches.");
      router.refresh();
    },
  });
  const hint =
    state.kind === "sharing" ? "On: members see that you can introduce them, and ask." : state.kind === "connected" ? "Off: your network powers only your own searches." : "Connect your network first.";
  return (
    <section className="fh-sheet" aria-label="Share my network">
      <SetRow
        label="Share my network"
        hint={hint}
        control={
          state.kind === "sharing" ? (
            <Button type="button" variant="secondary" size="sm" className="whitespace-nowrap" disabled={leave.isPending} onClick={() => leave.mutate()}>
              Stop sharing
            </Button>
          ) : state.kind === "connected" ? (
            <Button asChild variant="secondary" size="sm" className="whitespace-nowrap">
              <Link href={ROUTES.network}>Share</Link>
            </Button>
          ) : (
            <Button asChild variant="secondary" size="sm" className="whitespace-nowrap">
              <Link href={`${ROUTES.editCard}#network`}>My network</Link>
            </Button>
          )
        }
      />
      <FormError message={leave.error?.message ?? null} />
    </section>
  );
}
