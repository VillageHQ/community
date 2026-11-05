import { z } from "zod";

import { MEMBER_ERROR_CODES } from "../members/contract-linkedin.ts";
import { REQUEST_ERROR_CODES } from "../../platform/http/error-codes.ts";
import { VILLAGE_ERROR_CODES } from "../../platform/village/error-codes.ts";
import { INTRO_STATES } from "../../lib/intros/intro-api.ts";

export const NETWORK_STAGES = {
  notConfigured: "not_configured",
  needsEmailConfirmation: "needs_email_confirmation",
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
  ...REQUEST_ERROR_CODES,
  ...VILLAGE_ERROR_CODES,
  ...MEMBER_ERROR_CODES,
  emailNotConfirmed: "email_not_confirmed",
  notConfigured: "not_configured",
  notReady: "network_not_ready",
  keysMismatched: "village_keys_mismatched",
  groupExists: "group_exists",
  linkMismatch: "village_link_mismatch",
  linkChanged: "village_link_changed",
  searchCutOff: "search_cut_off",
  leaveNotConfirmed: "leave_not_confirmed",
  groupAdminCannotLeave: "group_admin_cannot_leave",
} as const;

const networkStageSchema = z.enum([
  NETWORK_STAGES.notConfigured,
  NETWORK_STAGES.needsEmailConfirmation,
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
      memberId: z.string().nullable(),
    }),
  ),
  discardedOffNetworkResults: z.boolean(),
  dailyLookupsLeft: z.number().int(),
});

export type NetworkSearchResult = z.infer<typeof networkSearchResultSchema>;
export type NetworkPerson = NetworkSearchResult["people"][number];

const pathPersonSchema = z.object({
  name: z.string(),
  linkedinSlug: z.string().nullable(),
  isMember: z.boolean(),
});

const connectorSchema = z.object({
  name: z.string(),
  headline: z.string().nullable(),
  linkedinSlug: z.string().nullable(),
  reason: z.string(),
  throughName: z.string().nullable(),
  member: z.object({ id: z.string(), avatarUrl: z.string().nullable() }).nullable(),
  openAsk: z.object({ id: z.uuid(), state: z.enum(INTRO_STATES) }).nullable(),
});

export type Connector = z.infer<typeof connectorSchema>;

export const networkPathsSchema = z.object({
  summary: z.string().nullable(),
  isTargetMember: z.boolean(),
  isCached: z.boolean(),
  targetName: z.string().nullable(),
  targetMemberId: z.string().nullable(),
  isViewer: z.boolean(),
  isDirectConnection: z.boolean(),
  dailyLookupsLeft: z.number().int(),
  connectors: z.array(connectorSchema),
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

export const LOW_LOOKUPS_LEFT = 10;

export const VILLAGE_STATUSES = {
  notShared: "not_shared",
  sharing: "sharing",
  syncing: "syncing",
  ready: "ready",
  blocked: "blocked",
} as const;

export const GROUP_DEPARTURE_OUTCOMES = { left: "left", creatorRefused: "creator_refused", failed: "failed" } as const;

export const USD_PER_CREDIT = 0.02;

export const CREDITS_PER_PATH_LOOKUP = 5;

export const CREDITS_PER_FULL_SEARCH = 11;

export const departureResponseSchema = z.object({ message: z.string(), isGroupLeaveIncomplete: z.boolean() });

export function isDepartureIncomplete(outcome: GroupDepartureOutcome | null) {
  return outcome === GROUP_DEPARTURE_OUTCOMES.failed || outcome === GROUP_DEPARTURE_OUTCOMES.creatorRefused;
}

export type GroupDepartureOutcome = (typeof GROUP_DEPARTURE_OUTCOMES)[keyof typeof GROUP_DEPARTURE_OUTCOMES];

export type VillageStatus = (typeof VILLAGE_STATUSES)[keyof typeof VILLAGE_STATUSES];
