"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { markPartnerReportSharedRequest } from "@/modules/admin/queries-partner-report";
import { ROUTES } from "@/platform/http/routes";

// The last setup step. Sending the report from its page finishes it; so does saying it went out another way.
export function ReportStep({ isDone }: { isDone: boolean }) {
  const router = useRouter();
  const markShared = useMutation({ mutationFn: markPartnerReportSharedRequest, onSuccess: () => router.refresh() });
  return (
    <div className="grid gap-3">
      <p className="type-small text-foreground-soft">
        The report shows totals per quarter. It never shows who asked whom. Email it to your partners from its page, or print it or download a CSV.
      </p>
      <FormError message={markShared.error?.message ?? null} />
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={ROUTES.adminReport}>Open the partner report</Link>
        </Button>
        {isDone ? null : (
          <Button type="button" size="sm" variant="outline" disabled={markShared.isPending} onClick={() => markShared.mutate()}>
            I shared it another way
          </Button>
        )}
      </div>
    </div>
  );
}
