import { z } from "zod";

export const NETWORK_STAGES = {
  notConfigured: "not_configured",
  needsLinkedin: "needs_linkedin",
  awaitingGroup: "awaiting_group",
  needsConsent: "needs_consent",
  needsSync: "needs_sync",
  syncing: "syncing",
  needsGroupCreation: "needs_group_creation",
  linkMismatch: "link_mismatch",
  ready: "ready",
} as const;

export const NETWORK_ERROR_CODES = {
  invalidRequest: "invalid_request",
  unauthenticated: "unauthenticated",
  forbidden: "forbidden",
  linkedinInvalid: "linkedin_invalid",
  linkedinTaken: "linkedin_taken",
  notConfigured: "not_configured",
  notReady: "network_not_ready",
  notSynced: "network_not_synced",
  dailyLimitReached: "daily_limit_reached",
  keysRejected: "village_keys_rejected",
  keysMismatched: "village_keys_mismatched",
  outOfCredits: "village_out_of_credits",
  notLinked: "village_not_linked",
  rateLimited: "village_rate_limited",
  unavailable: "village_unavailable",
  groupExists: "group_exists",
  forbiddenOrigin: "forbidden_origin",
  linkMismatch: "village_link_mismatch",
  linkChanged: "village_link_changed",
  searchCutOff: "search_cut_off",
  timedOut: "village_timed_out",
  leaveNotConfirmed: "leave_not_confirmed",
  memberNotFound: "member_not_found",
  groupAdminCannotLeave: "group_admin_cannot_leave",
} as const;

const networkStageSchema = z.enum([
  NETWORK_STAGES.notConfigured,
  NETWORK_STAGES.needsLinkedin,
  NETWORK_STAGES.awaitingGroup,
  NETWORK_STAGES.needsConsent,
  NETWORK_STAGES.needsSync,
  NETWORK_STAGES.syncing,
  NETWORK_STAGES.needsGroupCreation,
  NETWORK_STAGES.linkMismatch,
  NETWORK_STAGES.ready,
]);

export const networkStatusSchema = z.object({
  stage: networkStageSchema,
  isAdmin: z.boolean(),
  sync: z
    .object({ publicKey: z.string(), externalId: z.string(), sdkUrl: z.string() })
    .nullable(),
});

export type NetworkStatus = z.infer<typeof networkStatusSchema>;
export type NetworkStage = NetworkStatus["stage"];
export type VillageSyncConfig = NonNullable<NetworkStatus["sync"]>;

export const networkSearchResultSchema = z.object({
  people: z.array(
    z.object({
      fullName: z.string(),
      headline: z.string().nullable(),
      linkedinSlug: z.string().nullable(),
      isMember: z.boolean(),
    }),
  ),
  discardedOffNetworkResults: z.boolean(),
});

export type NetworkSearchResult = z.infer<typeof networkSearchResultSchema>;
export type NetworkPerson = NetworkSearchResult["people"][number];

const pathPersonSchema = z.object({
  name: z.string(),
  linkedinSlug: z.string().nullable(),
  isMember: z.boolean(),
});

export const networkPathsSchema = z.object({
  summary: z.string().nullable(),
  isTargetMember: z.boolean(),
  isCached: z.boolean(),
  paths: z.array(
    z.object({
      degree: z.number(),
      description: z.string().nullable(),
      scoreLabel: z.string().nullable(),
      involvesMember: z.boolean(),
      introducer: pathPersonSchema.nullable(),
      starters: z.array(pathPersonSchema.extend({ isCurrentUser: z.boolean() })),
    }),
  ),
});

export type NetworkPaths = z.infer<typeof networkPathsSchema>;
export type NetworkPath = NetworkPaths["paths"][number];

export const acknowledgedResponseSchema = z.object({ message: z.string() });
