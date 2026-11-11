"use client";

import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";

import { FormError } from "@/components/form-error";
import { useFlash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ASK_ALLOWANCE, describeAllowance } from "@/modules/asks/contract";
import { saveAllowanceRequest } from "@/modules/asks/queries";
import { OUTCOME_DAYS } from "@/modules/intros/contract-outcome-days";

import { INTRO_LOG_FLASH } from "../contract-intro-log";
import { downloadIntroLogCsv, saveOutcomeDaysRequest } from "../queries-intro-log";

// The Intro log's CSV button: the log of the period on screen, as a file.
export function IntroLogCsvButton({ period }: { period: string }) {
  const download = useMutation({ mutationFn: () => downloadIntroLogCsv(period) });
  return (
    <>
      <Button type="button" variant="secondary" size="sm" disabled={download.isPending} onClick={() => download.mutate()}>
        <Download aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
        CSV
      </Button>
      {download.error ? <FormError message={download.error.message} /> : null}
    </>
  );
}

type NumberSettingProps = {
  id: string;
  title: string;
  label: string;
  name: string;
  value: number;
  minimum: number;
  maximum: number;
  hint: ReactNode;
  save: (value: number) => Promise<unknown>;
  flash: string;
  className?: string;
};

// One sheet with one number and Save (Founderhall's `.pair` form). After saving, the flash says so at the top.
function NumberSetting({ id, title, label, name, value, minimum, maximum, hint, save, flash, className }: NumberSettingProps) {
  const router = useRouter();
  const showFlash = useFlash();
  const mutation = useMutation({
    mutationFn: save,
    onSuccess: () => {
      showFlash(flash);
      router.refresh();
      window.scrollTo({ top: 0 });
    },
  });
  const inputId = `${id}-value`;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(Number(new FormData(event.currentTarget).get(name)));
  }
  return (
    <Card id={id} className={className}>
      <section aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`} className="fh-h3">
          {title}
        </h2>
        <form className="fh-pair mt-2.5 items-end" onSubmit={submit} noValidate>
          <div>
            <label className="fh-label fh-small" htmlFor={inputId}>
              {label}
            </label>
            <Input id={inputId} name={name} type="number" inputMode="numeric" min={minimum} max={maximum} step={1} defaultValue={value} aria-invalid={mutation.isError || undefined} />
          </div>
          <div>
            <Button type="submit" variant="secondary" size="sm" disabled={mutation.isPending}>
              Save
            </Button>
          </div>
        </form>
        {mutation.error ? <FormError message={mutation.error.message} /> : null}
        <p className="fh-hint">{hint}</p>
      </section>
    </Card>
  );
}

export function AskAllowanceSetting({ weeklyAllowance }: { weeklyAllowance: number }) {
  return (
    <NumberSetting
      id="limits"
      className="fh-section"
      title="Asks a week"
      label="Asks per member a week"
      name="weeklyAllowance"
      value={weeklyAllowance}
      minimum={ASK_ALLOWANCE.minimum}
      maximum={ASK_ALLOWANCE.maximum}
      hint={`One allowance for asks posted and intro asks; members see “${describeAllowance({ left: 3, cap: weeklyAllowance })}”. Declined, expired and withdrawn intro asks come back. Default ${ASK_ALLOWANCE.default}. The same setting is in Asks & digest.`}
      save={saveAllowanceRequest}
      flash={INTRO_LOG_FLASH.limits}
    />
  );
}

export function OutcomeDaysSetting({ outcomeDays, reminderDays }: { outcomeDays: number; reminderDays: number }) {
  return (
    <NumberSetting
      id="outcome"
      className="mt-4"
      title="The outcome question"
      label="Days after each intro"
      name="outcomeDays"
      value={outcomeDays}
      minimum={OUTCOME_DAYS.minimum}
      maximum={OUTCOME_DAYS.maximum}
      hint={`The founder who asked is emailed “Was it helpful?” and what came of it, with one reminder ${reminderDays} days later. Default ${OUTCOME_DAYS.default}, in time for a 30-day trial; set 30 for a slower read.`}
      save={saveOutcomeDaysRequest}
      flash={INTRO_LOG_FLASH.outcomeDays}
    />
  );
}
