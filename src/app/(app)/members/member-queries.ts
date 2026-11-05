import { queryOptions } from "@tanstack/react-query";

import { directorySchema, type DirectoryFilters } from "@/lib/members/profile-api";
import { API_ROUTES } from "@/lib/routes";
import { postNetworkRequest } from "@/lib/village/post-network-request";

export const MEMBER_QUERY_KEYS = { directory: "member-directory" } as const;

const DIRECTORY_STALE_MS = 30_000;

export function directoryQuery(filters: DirectoryFilters) {
  return queryOptions({
    queryKey: [MEMBER_QUERY_KEYS.directory, filters],
    queryFn: () => postNetworkRequest(API_ROUTES.memberDirectory, filters, directorySchema),
    staleTime: DIRECTORY_STALE_MS,
  });
}
