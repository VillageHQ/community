import { queryOptions, skipToken } from "@tanstack/react-query";

import { API_ROUTES } from "@/platform/http/routes";
import {
  NETWORK_STAGES,
  networkPathsSchema,
  networkSearchResultSchema,
  networkStatusSchema,
  type NetworkStage,
  type NetworkStatus,
} from "@/modules/network/contract";
import { postNetworkRequest } from "@/platform/http/post-request";

const STATUS_POLL_INTERVAL_MS = 5_000;
const POLLED_STAGES: ReadonlySet<NetworkStage> = new Set([
  NETWORK_STAGES.needsEmailConfirmation,
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
  activeSearch: "network-active-search",
} as const;

export type ActiveSearch = { prompt: string; startedAtMs: number; wasSeen: boolean };


const SPENDS_CREDITS_ONLY_ON_REQUEST = {
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  retryOnMount: false,
};

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
    ...SPENDS_CREDITS_ONLY_ON_REQUEST,
  });
}

export function networkPathsQuery(linkedinSlug: string) {
  return queryOptions({
    queryKey: [NETWORK_QUERY_KEYS.paths, linkedinSlug],
    queryFn: () => postNetworkRequest(API_ROUTES.networkPaths, { linkedinSlug }, networkPathsSchema),
    ...SPENDS_CREDITS_ONLY_ON_REQUEST,
  });
}

export const activeSearchQuery = queryOptions<ActiveSearch | null>({
  queryKey: [NETWORK_QUERY_KEYS.activeSearch],
  queryFn: skipToken,
  initialData: null,
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
});
