"use client";

import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { FormError } from "@/components/form-error";
import { Button, ButtonRow } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SetRow } from "@/components/ui/rows";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ASKS_ADMIN_PAGE } from "@/modules/asks/contract";
import { closeAskAsAdminRequest, pinAskRequest, removeAskRequest, saveAllowanceRequest } from "@/modules/asks/queries";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { WEEKDAYS, type WeeklySchedule } from "@/platform/weekly-email/schedule";

const messageSchema = z.object({ message: z.string() });
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

// After an action the page reloads with Founderhall's flash (?m=pin, ?m=asksettings…).
function useLandWithFlash() {
  const router = useRouter();
  return (flash: string) => {
    router.replace(`${ASKS_ADMIN_PAGE}?m=${flash}`, { scroll: false });
    router.refresh();
  };
}

type AskRowActionsProps = { askId: string; title: string; isPinned: boolean; canPin: boolean; canClose: boolean };

// Pin / Unpin · Close · Remove: quiet small buttons at the end of each row.
export function AskRowActions({ askId, title, isPinned, canPin, canClose }: AskRowActionsProps) {
  const land = useLandWithFlash();
  const pin = useMutation({ mutationFn: () => pinAskRequest({ askId, isPinned: !isPinned }), onSuccess: () => land(isPinned ? "unpin" : "pin") });
  const close = useMutation({ mutationFn: () => closeAskAsAdminRequest(askId), onSuccess: () => land("close") });
  const remove = useMutation({ mutationFn: () => removeAskRequest(askId), onSuccess: () => land("remove") });
  const isBusy = pin.isPending || close.isPending || remove.isPending;
  const error = pin.error ?? close.error ?? remove.error;
  const about = title.slice(0, 60);
  return (
    <span>
      {canPin ? (
        <Button type="button" variant="quiet" size="sm" disabled={isBusy} aria-label={`${isPinned ? "Unpin" : "Pin"}: ${about}`} onClick={() => pin.mutate()}>
          {isPinned ? "Unpin" : "Pin"}
        </Button>
      ) : null}
      {canClose ? (
        <Button type="button" variant="quiet" size="sm" disabled={isBusy} aria-label={`Close: ${about}`} onClick={() => close.mutate()}>
          Close
        </Button>
      ) : null}
      <Button
        type="button"
        variant="quiet"
        size="sm"
        disabled={isBusy}
        aria-label={`Remove: ${about}`}
        onClick={() => {
          if (window.confirm("Remove this for everyone? It stays in the audit log.")) remove.mutate();
        }}
      >
        Remove
      </Button>
      {error ? <FormError message={error.message} /> : null}
    </span>
  );
}

type DigestSettingsFormProps = { isEnabled: boolean; schedule: WeeklySchedule; weeklyAllowance: number };

// The weekly digest's settings (Founderhall's): the switch, day, hour, time zone, and the one weekly allowance.
export function DigestSettingsForm({ isEnabled: savedEnabled, schedule, weeklyAllowance }: DigestSettingsFormProps) {
  const land = useLandWithFlash();
  const [isEnabled, setEnabled] = useState(savedEnabled);
  const [weekday, setWeekday] = useState(schedule.weekday);
  const [hour, setHour] = useState(schedule.hour);
  const [timeZone, setTimeZone] = useState(schedule.timeZone);
  const [allowance, setAllowance] = useState(String(weeklyAllowance));
  const save = useMutation({
    mutationFn: async () => {
      await postRequest(API_ROUTES.adminWeeklyEmailSchedule, { isEnabled, weekday, hour, timeZone }, messageSchema);
      const cap = Number(allowance);
      if (cap !== weeklyAllowance) await saveAllowanceRequest(cap);
    },
    onSuccess: () => land("asksettings"),
  });
  return (
    <form
      className="mt-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <SetRow
        htmlFor="a-digest"
        label="Send the weekly digest"
        hint="One email per member, only when something needs them."
        control={<Switch id="a-digest" checked={isEnabled} onCheckedChange={setEnabled} aria-label="Send the weekly digest" />}
      />
      <div className="fh-pair mt-3">
        <div>
          <label className="fh-label fh-small" htmlFor="a-day">
            Day
          </label>
          <Select id="a-day" value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>
            {WEEKDAYS.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="fh-label fh-small" htmlFor="a-hour">
            Hour
          </label>
          <Select id="a-hour" value={hour} onChange={(event) => setHour(Number(event.target.value))}>
            {HOURS.map((value) => (
              <option key={value} value={value}>
                {String(value).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="fh-field">
        <label className="fh-label fh-small" htmlFor="a-tz">
          Time zone
        </label>
        <Input id="a-tz" value={timeZone} placeholder="e.g. Europe/London" autoComplete="off" onChange={(event) => setTimeZone(event.target.value)} />
        <p className="fh-hint">An IANA name, like Europe/London or America/New_York.</p>
      </div>
      <div className="fh-field">
        <label className="fh-label fh-small" htmlFor="a-cap">
          Asks a member can make a week
        </label>
        <Input id="a-cap" inputMode="numeric" value={allowance} className="max-w-[120px]" onChange={(event) => setAllowance(event.target.value)} />
        <p className="fh-hint">One allowance for asks posted and intro asks. Default 5.</p>
      </div>
      <FormError message={save.error?.message ?? null} />
      <ButtonRow className="mt-3">
        <Button type="submit" size="sm" disabled={save.isPending}>
          Save
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href={ROUTES.adminDigest}>
            <Mail aria-hidden="true" />
            Preview the digest
          </Link>
        </Button>
      </ButtonRow>
    </form>
  );
}
