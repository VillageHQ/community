"use client";

import { useMutation } from "@tanstack/react-query";
import { RefreshCw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { useFlash } from "@/components/flash";
import { Field } from "@/components/form-field";
import { OptionCard } from "@/components/ui/checkbox-card";
import { Button, ButtonRow } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SetRow } from "@/components/ui/rows";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FILL_IN_BASES, type FillInBasis, type FillInBasisBody } from "@/modules/members/contract-fill-in";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

import { PUBLIC_KEY_HINT, SECRET_KEY_HINT, VILLAGE_LIMITS_API, type VillageLimitsBody } from "../contract-village-admin";
import { INTRODUCER_RULES, SEARCH_SCOPES, type IntroducerRule, type SearchScope } from "../contract-village-settings";

// Admin › Village's forms (Founderhall's Village page). Each action says what happened in the flash at the top.

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "That didn't work. Try again.";
}

function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="fh-hint fh-err">
      {message}
    </p>
  ) : null;
}

// Connection: the two keys, checked with Village before they're saved.
export function VillageKeysForm({ hasSavedKeys }: { hasSavedKeys: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: { publicKey: string; secretKey: string }) => postRequest(API_ROUTES.villageKeys, body, acknowledgedResponseSchema),
    onSuccess: () => window.location.assign(window.location.pathname),
    onError: (failure) => setError(errorText(failure)),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    save.mutate({ publicKey: String(form.get("public_key") ?? ""), secretKey: String(form.get("api_key") ?? "") });
  }
  const placeholder = (fresh: string) => (hasSavedKeys ? "Saved (paste to replace)" : fresh);
  return (
    <form onSubmit={submit} className="mt-3">
      <Field
        htmlFor="v-api_key"
        label="Secret key"
        hint={SECRET_KEY_HINT}
        className="fh-field"
      >
        <Input id="v-api_key" name="api_key" type="password" autoComplete="off" placeholder={placeholder("Paste the secret key")} className="fh-mono" required />
      </Field>
      <Field htmlFor="v-public_key" label="Public key" hint={PUBLIC_KEY_HINT} className="fh-field">
        <Input id="v-public_key" name="public_key" autoComplete="off" placeholder={placeholder("Paste the public key")} className="fh-mono" required />
      </Field>
      <ErrorLine message={error} />
      <ButtonRow className="mt-3">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? "Checking keys…" : "Save keys"}
        </Button>
      </ButtonRow>
    </form>
  );
}

// "Test the connection": Community's Village check (free calls only): the keys, the group and every member.
export function TestConnectionButton() {
  const router = useRouter();
  const flash = useFlash();
  const isRunning = useRef(false);
  const check = useMutation({
    mutationFn: () => postRequest(API_ROUTES.villageCheck, {}, acknowledgedResponseSchema),
    onSuccess: () => router.refresh(),
    onError: (failure) => flash(errorText(failure), { kind: "needs" }),
    onSettled: () => {
      isRunning.current = false;
    },
  });
  function start() {
    if (isRunning.current) return;
    isRunning.current = true;
    check.mutate();
  }
  return (
    <div className="mt-3.5">
      <Button type="button" variant="secondary" size="sm" disabled={check.isPending} onClick={start}>
        <RefreshCw aria-hidden="true" className={check.isPending ? "animate-spin motion-reduce:animate-none" : undefined} />
        {check.isPending ? "Asking Village…" : "Test the connection"}
      </Button>
    </div>
  );
}

type LimitsValues = Omit<VillageLimitsBody, "searchScope" | "introducers"> & { searchScope: SearchScope; introducers: IntroducerRule };

type VillageLimitsFormProps = {
  values: LimitsValues;
  sharingMembers: { id: string; name: string }[];
  defaultServiceEmail: string | null;
  communityName: string;
  defaults: { cap: string; dailyLimit: number };
};

// "Limits and switches": one Save, as in Founderhall.
export function VillageLimitsForm({ values, sharingMembers, defaultServiceEmail, communityName, defaults }: VillageLimitsFormProps) {
  const router = useRouter();
  const flash = useFlash();
  const [error, setError] = useState<string | null>(null);
  const [isNightlyOn, setIsNightlyOn] = useState(values.isNightlyFillInOn);
  const [introducers, setIntroducers] = useState<IntroducerRule>(values.introducers);
  const save = useMutation({
    mutationFn: (body: VillageLimitsBody) => postRequest(VILLAGE_LIMITS_API, body, acknowledgedResponseSchema),
    onSuccess: ({ message }) => {
      flash(message);
      window.scrollTo({ top: 0 });
      router.refresh();
    },
    onError: (failure) => setError(errorText(failure)),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    save.mutate({
      cap: Number(form.get("credit_cap")),
      dailyLimit: Number(form.get("member_daily_cap")),
      searchScope: form.get("default_scope") === SEARCH_SCOPES.everyone ? SEARCH_SCOPES.everyone : SEARCH_SCOPES.network,
      serviceEmail: String(form.get("service_email") ?? ""),
      dataRegion: String(form.get("data_region") ?? ""),
      dpaUrl: String(form.get("dpa_url") ?? ""),
      isNightlyFillInOn: isNightlyOn,
      introducers,
      chosenIntroducerIds: introducers === INTRODUCER_RULES.chosen ? form.getAll("introducer").map(String) : [],
    });
  }
  const serviceDefault = defaultServiceEmail ? ` (${defaultServiceEmail})` : "";
  return (
    <form onSubmit={submit} className="fh-sheet" noValidate>
      <h2 className="type-h3">Limits and switches</h2>
      <div className="fh-pair mt-2.5">
        <Field htmlFor="v-cap" label="Lookups a month (limit)" hint={`Calls stop here; a warning goes to admins at 80%. Default ${defaults.cap}.`}>
          <Input id="v-cap" name="credit_cap" inputMode="numeric" defaultValue={values.cap} className="fh-mono" />
        </Field>
        <Field htmlFor="v-mcap" label="Lookups a member can use a day" hint={`Searches and path lookups together. Default ${defaults.dailyLimit}.`}>
          <Input id="v-mcap" name="member_daily_cap" inputMode="numeric" defaultValue={values.dailyLimit} className="fh-mono" />
        </Field>
      </div>
      <Field htmlFor="v-scope" label="Search starts in" className="fh-field">
        <Select id="v-scope" name="default_scope" defaultValue={values.searchScope}>
          <option value={SEARCH_SCOPES.network}>In our network</option>
          <option value={SEARCH_SCOPES.everyone}>Everywhere</option>
        </Select>
      </Field>
      <Field
        htmlFor="v-email"
        label="Service email"
        hint={`The community’s own Village account (it owns the members’ group and runs searches for members who haven’t connected). Default: the first admin’s address${serviceDefault}, so leave it blank unless Village asked for another.`}
        className="fh-field"
      >
        <Input id="v-email" name="service_email" type="email" defaultValue={values.serviceEmail} placeholder="e.g. village@fund.example" />
      </Field>
      <div className="fh-pair mt-3">
        <Field
          htmlFor="v-region"
          label="Where the data is processed"
          hint={`Shown on the connect screen. Leave it blank until Village confirms it: members then read “Ask ${communityName} where the data is processed” with your data-protection contact.`}
        >
          <Input id="v-region" name="data_region" maxLength={80} defaultValue={values.dataRegion} placeholder="e.g. the EU (Frankfurt)" />
        </Field>
        <Field htmlFor="v-dpa" label="Data agreement with Village (link)" hint="Members see “Read it” beside the region. Blank: no link.">
          <Input id="v-dpa" name="dpa_url" maxLength={300} defaultValue={values.dpaUrl} placeholder="https://…" />
        </Field>
      </div>
      <SetRow
        htmlFor="v-embed"
        label="Village’s sync screen"
        hint="Members connect their network on Village’s own screen, from Profile › My network. On by default once the public key is set."
        control={<Switch id="v-embed" checked disabled aria-label="Village’s sync screen: always on in this version" />}
      />
      <Field
        htmlFor="v-auth"
        label="How the sync screen knows the member"
        hint="By the member’s number (Village documents this as live). By a signed token from this portal (Village marks this “coming soon”; ask Village before switching)."
        className="fh-field"
      >
        <Select id="v-auth" name="embed_auth" defaultValue="identify" disabled>
          <option value="identify">By the member’s number</option>
          <option value="authorize">By a signed token from this portal</option>
        </Select>
      </Field>
      <SetRow
        htmlFor="v-restrict"
        label="Only paths through members who agreed to share"
        hint="Searches by members who haven’t connected go only through consenting members."
        control={<Switch id="v-restrict" checked disabled aria-label="Only paths through members who agreed to share: always on" />}
      />
      <Field htmlFor="v-introducers" label="Who can introduce" hint="Paths through other members are left out, and only the chosen can offer intros." className="fh-field">
        <Select id="v-introducers" value={introducers} onChange={(event) => setIntroducers(event.target.value === INTRODUCER_RULES.chosen ? INTRODUCER_RULES.chosen : INTRODUCER_RULES.allSharing)}>
          <option value={INTRODUCER_RULES.allSharing}>Every member who shares their network</option>
          <option value={INTRODUCER_RULES.chosen}>Only members you choose</option>
        </Select>
      </Field>
      {introducers === INTRODUCER_RULES.chosen ? (
        <fieldset className="mt-2.5 grid gap-2">
          <legend className="sr-only">Members who can introduce</legend>
          {sharingMembers.length === 0 ? <p className="fh-hint">Nobody shares their network yet.</p> : null}
          {sharingMembers.map((member) => (
            <OptionCard
              key={member.id}
              type="checkbox"
              id={`v-introducer-${member.id}`}
              name="introducer"
              value={member.id}
              defaultChecked={values.chosenIntroducerIds.includes(member.id)}
              title={member.name}
            />
          ))}
        </fieldset>
      ) : null}
      <SetRow
        htmlFor="v-nightly"
        label="Fill in profiles every night"
        hint="At 02:00 UTC, members not refreshed for 30 days."
        control={<Switch id="v-nightly" checked={isNightlyOn} onCheckedChange={setIsNightlyOn} />}
      />
      <ErrorLine message={error} />
      <ButtonRow className="mt-3">
        <Button type="submit" size="sm" disabled={save.isPending}>
          Save
        </Button>
      </ButtonRow>
    </form>
  );
}

// Profile fill-in: Community asks what lets it fill in profiles (the terms, or each member) before any lookup.
const BASIS_OFF = "off";

type BasisChoice = FillInBasis | typeof BASIS_OFF;

export function FillInBasisForm({ basis, termsDate }: { basis: FillInBasis | null; termsDate: string | null }) {
  const router = useRouter();
  const flash = useFlash();
  const [choice, setChoice] = useState<BasisChoice>(basis ?? BASIS_OFF);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: FillInBasisBody) => postRequest(API_ROUTES.adminFillIn, body, acknowledgedResponseSchema),
    onSuccess: ({ message }) => {
      flash(message);
      router.refresh();
    },
    onError: (failure) => setError(errorText(failure)),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    if (choice === FILL_IN_BASES.terms) save.mutate({ basis: choice, termsDate: String(form.get("lookup_basis_date") ?? "") });
    else if (choice === FILL_IN_BASES.ask) save.mutate({ basis: choice });
    else save.mutate({ basis: BASIS_OFF });
  }
  return (
    <form onSubmit={submit} className="mt-3.5">
      <fieldset className="grid gap-2">
        <legend className="fh-label">Profile fill-in: how did these members agree?</legend>
        <OptionCard
          id="v-basis-terms"
          name="lookup_basis"
          value={FILL_IN_BASES.terms}
          checked={choice === FILL_IN_BASES.terms}
          onChange={() => setChoice(FILL_IN_BASES.terms)}
          title="Members agreed in our membership terms on"
          description={
            choice === FILL_IN_BASES.terms ? (
              <Input type="date" name="lookup_basis_date" defaultValue={termsDate ?? ""} aria-label="The date members agreed to the membership terms" className="mt-1.5" required />
            ) : undefined
          }
        />
        <OptionCard
          id="v-basis-ask"
          name="lookup_basis"
          value={FILL_IN_BASES.ask}
          checked={choice === FILL_IN_BASES.ask}
          onChange={() => setChoice(FILL_IN_BASES.ask)}
          title="Ask each member at sign-in"
          isRecommended
          description="Nothing is filled in until they tick “Fill in my profile from public profiles”."
        />
        <OptionCard
          id="v-basis-off"
          name="lookup_basis"
          value={BASIS_OFF}
          checked={choice === BASIS_OFF}
          onChange={() => setChoice(BASIS_OFF)}
          title="Off"
          description="Nobody is looked up, and lines already filled in are removed."
        />
      </fieldset>
      <ErrorLine message={error} />
      <ButtonRow className="mt-2.5">
        <Button type="submit" variant="secondary" size="sm" disabled={save.isPending}>
          Save
        </Button>
      </ButtonRow>
    </form>
  );
}

export function FillInNowButton({ isDisabled }: { isDisabled: boolean }) {
  const router = useRouter();
  const flash = useFlash();
  const run = useMutation({
    mutationFn: () => postRequest(API_ROUTES.adminFillInRun, {}, acknowledgedResponseSchema),
    onSuccess: ({ message }) => {
      flash(message);
      router.refresh();
    },
    onError: (failure) => flash(errorText(failure), { kind: "needs" }),
  });
  return (
    <div className="mt-2.5">
      <Button type="button" variant="secondary" size="sm" disabled={isDisabled || run.isPending} onClick={() => run.mutate()}>
        <RefreshCw aria-hidden="true" className={run.isPending ? "animate-spin motion-reduce:animate-none" : undefined} />
        {run.isPending ? "Filling in…" : "Fill in profiles now"}
      </Button>
    </div>
  );
}

// A nudge: one email each, at most once a month per member.
export function NudgeButton({ audience, label, hint }: { audience: "unconnected" | "no_asks"; label: string; hint: string }) {
  const router = useRouter();
  const flash = useFlash();
  const nudge = useMutation({
    mutationFn: () => postRequest(API_ROUTES.connectNudge, { audience }, acknowledgedResponseSchema),
    onSuccess: ({ message }) => {
      flash(message);
      window.scrollTo({ top: 0 });
      router.refresh();
    },
    onError: (failure) => flash(errorText(failure), { kind: "needs" }),
  });
  return (
    <div className="mt-3">
      <Button type="button" variant="secondary" size="sm" disabled={nudge.isPending} onClick={() => nudge.mutate()}>
        <Send aria-hidden="true" />
        {label}
      </Button>
      <p className="fh-hint">{hint}</p>
    </div>
  );
}
