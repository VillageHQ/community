"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { Switch } from "@/components/ui/switch";
import { reportCreditSchema } from "@/modules/members/contract-report-credit";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

const LABEL_ID = "report-credit-title";

export function ReportCreditCard({ isOn: initialIsOn }: { isOn: boolean }) {
  const [isOn, setIsOn] = useState(initialIsOn);
  const mutation = useMutation({
    mutationFn: (nextIsOn: boolean) => postRequest(API_ROUTES.profileReportCredit, { isOn: nextIsOn }, reportCreditSchema),
    onSuccess: (saved) => setIsOn(saved.isOn),
  });
  return (
    <section aria-labelledby={LABEL_ID} className="mt-5 grid gap-2 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h2 id={LABEL_ID} className="type-h3">
            Credit me in reports
          </h2>
          <p className="type-small text-foreground-soft">
            Admins send a partner report with this community&apos;s totals. Turn this on to be named among its top connectors. Off, you&apos;re only part of a count. Who you introduced is never in it.
          </p>
        </div>
        <Switch
          aria-labelledby={LABEL_ID}
          checked={mutation.isPending ? mutation.variables : isOn}
          disabled={mutation.isPending}
          onCheckedChange={(checked) => mutation.mutate(checked)}
        />
      </div>
      <FormError message={mutation.error?.message ?? null} />
    </section>
  );
}
