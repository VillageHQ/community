"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, Printer, Send } from "lucide-react";
import Link from "next/link";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/platform/http/routes";
import type { ConsolePeriodParam } from "@/modules/admin/console-periods";
import { downloadPartnerReportCsv } from "@/modules/admin/queries-partner-report";

import { PeriodSwitch } from "./period-switch";

const ICON = { "aria-hidden": true, strokeWidth: 1.5 } as const;

// Founderhall's report toolbar: the period switch, Send to partners, CSV and PDF (the browser's print to PDF).
// It never prints.
export function ReportActions({ period }: { period: ConsolePeriodParam }) {
  const download = useMutation({ mutationFn: () => downloadPartnerReportCsv(period) });
  return (
    <div data-print="hide" className="fh-report-actions fh-no-print">
      <PeriodSwitch basePath={ROUTES.adminReport} current={period} />
      <Button asChild size="sm">
        <Link href={`${ROUTES.adminReportSend}?period=${period}`}>
          <Send {...ICON} />
          Send to partners
        </Link>
      </Button>
      <Button type="button" variant="secondary" size="sm" disabled={download.isPending} onClick={() => download.mutate()}>
        <Download {...ICON} />
        CSV
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => window.print()}>
        <Printer {...ICON} />
        PDF
      </Button>
      {download.error ? <FormError message={download.error.message} /> : null}
    </div>
  );
}
