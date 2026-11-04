import { queryOptions } from "@tanstack/react-query";

import { API_ROUTES } from "@/lib/routes";
import {
  NETWORK_STAGES,
  networkPathsSchema,
  networkSearchResultSchema,
  networkStatusSchema,
  type NetworkStage,
  type NetworkStatus,
} from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

const STATUS_POLL_INTERVAL_MS = 5_000;
const POLLED_STAGES: ReadonlySet<NetworkStage> = new Set([
  NETWORK_STAGES.needsSync,
  NETWORK_STAGES.syncing,
  NETWORK_STAGES.linkMismatch,
]);

const SEARCH_CUT_OFF_MESSAGE =
  "This search took too long and was cut off. It may have used one lookup. Try fewer, more specific words.";

export const NETWORK_QUERY_KEYS = {
  status: "network-status",
  search: "network-search",
  paths: "network-paths",
} as const;

function isPolled(status: NetworkStatus | undefined) {
  return status !== undefined && POLLED_STAGES.has(status.stage);
}

export function readStatusPollInterval(status: NetworkStatus | undefined) {
  return isPolled(status) ? STATUS_POLL_INTERVAL_MS : false;
}

export const networkStatusQuery = queryOptions({
  queryKey: [NETWORK_QUERY_KEYS.status],
  queryFn: () => postNetworkRequest(API_ROUTES.networkStatus, {}, networkStatusSchema),
  refetchIntervalInBackground: false,
  refetchInterval: ({ state }) => readStatusPollInterval(state.data),
  refetchOnWindowFocus: ({ state }) => isPolled(state.data),
});

export function networkSearchQuery(prompt: string) {
  return queryOptions({
    queryKey: [NETWORK_QUERY_KEYS.search, prompt],
    queryFn: () =>
      postNetworkRequest(
        API_ROUTES.networkSearch,
        { prompt },
        networkSearchResultSchema,
        SEARCH_CUT_OFF_MESSAGE,
      ),
    staleTime: Infinity,
  });
}

export function networkPathsQuery(linkedinSlug: string) {
  return queryOptions({
    queryKey: [NETWORK_QUERY_KEYS.paths, linkedinSlug],
    queryFn: () => postNetworkRequest(API_ROUTES.networkPaths, { linkedinSlug }, networkPathsSchema),
    staleTime: Infinity,
  });
}
