import { queryOptions } from "@tanstack/react-query";

import { auditPageSchema } from "@/lib/admin/admin-api";
import { API_ROUTES } from "@/platform/http/routes";
import { postNetworkRequest } from "@/lib/village/post-network-request";

export const AUDIT_QUERY_KEYS = { log: "admin-audit-log" } as const;

const AUDIT_LOG_STALE_MS = 15_000;

export function auditPageQuery(page: number) {
  return queryOptions({
    queryKey: [AUDIT_QUERY_KEYS.log, page],
    queryFn: () => postNetworkRequest(API_ROUTES.auditLog, { page }, auditPageSchema),
    staleTime: AUDIT_LOG_STALE_MS,
  });
}
