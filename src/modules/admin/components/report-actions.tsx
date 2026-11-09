"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { downloadPartnerReportCsv } from "@/modules/admin/queries-partner-report";

export function ReportActions() {
  const download = useMutation({ mutationFn: downloadPartnerReportCsv });
  return (
    <div data-print="hide" className="grid justify-items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Print
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={download.isPending} onClick={() => download.mutate()}>
          <Download aria-hidden="true" />
          {download.isPending ? "Preparing…" : "Download CSV"}
        </Button>
      </div>
      <FormError message={download.error?.message ?? null} />
    </div>
  );
}
