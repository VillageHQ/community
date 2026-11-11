"use client";

import { Flag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { REPORT_TARGETS } from "@/modules/admin/contract";
import { deleteReportedContentRequest, dismissReportRequest } from "@/modules/admin/queries-reports";
import { ROUTES } from "@/platform/http/routes";
import type { ReportedAsk } from "@/shell/admin-asks";

function ReportedAskRow({ reported }: { reported: ReportedAsk }) {
  const router = useRouter();
  const body = { reportId: reported.reportId, targetType: reported.targetType };
  const remove = useMutation({ mutationFn: () => deleteReportedContentRequest(body), onSuccess: () => router.refresh() });
  const keep = useMutation({ mutationFn: () => dismissReportRequest(body), onSuccess: () => router.refresh() });
  const isAnswer = reported.targetType === REPORT_TARGETS.askAnswer;
  const isPending = remove.isPending || keep.isPending;
  return (
    <li className="grid gap-2.5 rounded-field bg-muted p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="destructive">
          <Flag aria-hidden="true" />
          {isAnswer ? "Answer on an ask" : "Ask"}
        </Tag>
        <span className="type-small text-foreground-soft">{reported.reportCount === 1 ? "1 report" : `${reported.reportCount} reports`}</span>
      </div>
      <p className="wrap-anywhere whitespace-pre-wrap">{reported.body}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={isPending}
          aria-label={`${isAnswer ? "Remove the answer" : "Remove the ask"}: ${reported.body.slice(0, 60)}`}
          className="max-sm:w-full"
          onClick={() => remove.mutate()}
        >
          {remove.isPending ? "Removing…" : isAnswer ? "Remove the answer" : "Remove the ask"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          aria-label={`Keep it: ${reported.body.slice(0, 60)}`}
          className="max-sm:w-full"
          onClick={() => keep.mutate()}
        >
          {keep.isPending ? "Keeping…" : "Keep it"}
        </Button>
      </div>
      <FormError message={remove.error?.message ?? keep.error?.message ?? null} />
    </li>
  );
}

// Reported asks and answers on Admin › Asks. The same reports, and the same actions, as the Reports page.
export function ReportedAsks({ reported }: { reported: ReportedAsk[] }) {
  if (reported.length === 0) return <p className="type-small text-foreground-soft">Nobody has reported an ask or an answer.</p>;
  return (
    <div className="grid gap-2.5">
      <ul className="grid gap-2.5">
        {reported.map((item) => (
          <ReportedAskRow key={item.reportId} reported={item} />
        ))}
      </ul>
      <Link href={ROUTES.adminReports} className="type-small font-semibold underline underline-offset-4">
        See every report, with who was reported
      </Link>
    </div>
  );
}
