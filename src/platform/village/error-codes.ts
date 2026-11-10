export const VILLAGE_ERROR_CODES = {
  notSynced: "network_not_synced",
  dailyLimitReached: "daily_limit_reached",
  monthlyCapReached: "monthly_cap_reached",
  keysRejected: "village_keys_rejected",
  keysUnstorable: "village_keys_unstorable",
  outOfCredits: "village_out_of_credits",
  notLinked: "village_not_linked",
  rateLimited: "village_rate_limited",
  unavailable: "village_unavailable",
  timedOut: "village_timed_out",
} as const;
