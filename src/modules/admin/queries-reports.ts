import { queryOptions } from "@tanstack/react-query";

import { reportPageSchema, type ReportActionBody, type ReportFilter } from "@/modules/admin/contract";
import { API_ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

export const REPORT_QUERY_KEYS = { list: "admin-report-list" } as const;

const REPORT_LIST_STALE_MS = 15_000;

export function reportPageQuery(filter: ReportFilter, page: number) {
  return queryOptions({
    queryKey: [REPORT_QUERY_KEYS.list, filter, page],
    queryFn: () => postRequest(API_ROUTES.reportList, { filter, page }, reportPageSchema),
    staleTime: REPORT_LIST_STALE_MS,
  });
}

export function dismissReportRequest(body: ReportActionBody) {
  return postRequest(API_ROUTES.reportDismiss, body, acknowledgedResponseSchema);
}

export function deleteReportedContentRequest(body: ReportActionBody) {
  return postRequest(API_ROUTES.reportDeleteContent, body, acknowledgedResponseSchema);
}
