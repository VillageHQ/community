"use client";

import { Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { REPORT_TARGETS } from "@/modules/admin/contract";
import { deleteReportedContentRequest, dismissReportRequest } from "@/modules/admin/queries-reports";
import type { ReportedAsk } from "@/shell/admin-asks";

function ReportedAskRow({ reported }: { reported: ReportedAsk }) {
  const router = useRouter();
  const body = { reportId: reported.reportId, targetType: reported.targetType };
  const remove = useMutation({ mutationFn: () => deleteReportedContentRequest(body), onSuccess: () => router.refresh() });
  const keep = useMutation({ mutationFn: () => dismissReportRequest(body), onSuccess: () => router.refresh() });
  const isAnswer = reported.targetType === REPORT_TARGETS.askAnswer;
  const isPending = remove.isPending || keep.isPending;
  return (
    <div className="fh-r">
      <span>
        <Flag aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
      </span>
      <div className="fh-who">
        <b className="fh-plain wrap-anywhere whitespace-pre-wrap">{reported.body}</b>
        <span>
          {isAnswer ? "Answer on an ask" : "Ask"} · {reported.reportCount === 1 ? "1 report" : `${reported.reportCount} reports`}
        </span>
        <FormError message={remove.error?.message ?? keep.error?.message ?? null} />
      </div>
      <div className="fh-end">
        <Pill tone="needs">Reported</Pill>
        <span>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            disabled={isPending}
            aria-label={`${isAnswer ? "Remove the answer" : "Remove the ask"}: ${reported.body.slice(0, 60)}`}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? "Removing…" : isAnswer ? "Remove the answer" : "Remove the ask"}
          </Button>
          <Button type="button" variant="quiet" size="sm" disabled={isPending} aria-label={`Keep it: ${reported.body.slice(0, 60)}`} onClick={() => keep.mutate()}>
            {keep.isPending ? "Keeping…" : "Keep it"}
          </Button>
        </span>
      </div>
    </div>
  );
}

// Reported asks and answers on Asks & digest (Community's): the same reports, and the same actions, as the Reports page.
export function ReportedAsks({ reported }: { reported: ReportedAsk[] }) {
  return (
    <div className="fh-rows fh-modrows mt-3">
      {reported.map((item) => (
        <ReportedAskRow key={item.reportId} reported={item} />
      ))}
    </div>
  );
}
