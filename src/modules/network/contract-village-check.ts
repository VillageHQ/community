// The Village check: what Village says about the keys, the community group and each member. Client-safe.

export const VILLAGE_CHECK_KEYS = {
  ok: "ok",
  rejected: "rejected",
  mismatched: "mismatched",
  missing: "missing",
  unreachable: "unreachable",
} as const;

export const VILLAGE_CHECK_GROUP = { found: "found", missing: "missing", none: "none" } as const;

export const MEMBER_CHECK_OUTCOMES = { notStarted: "not_started", checked: "checked", unreachable: "unreachable" } as const;

// "Check again" runs at most once a minute for the whole community.
export const VILLAGE_CHECK_INTERVAL_MS = 60_000;

export const VILLAGE_CHECK_ERROR_CODES = { tooSoon: "village_check_too_soon" } as const;

export type VillageCheckKeys = (typeof VILLAGE_CHECK_KEYS)[keyof typeof VILLAGE_CHECK_KEYS];
export type VillageCheckGroup = (typeof VILLAGE_CHECK_GROUP)[keyof typeof VILLAGE_CHECK_GROUP];
export type MemberCheckOutcome = (typeof MEMBER_CHECK_OUTCOMES)[keyof typeof MEMBER_CHECK_OUTCOMES];

// Village's own user statuses; "connected" means the network synced.
const CONNECTED_STATUSES: ReadonlySet<string> = new Set(["ready", "needs_attention"]);

export function isConnectedStatus(networkStatus: string | null) {
  return networkStatus !== null && CONNECTED_STATUSES.has(networkStatus);
}
