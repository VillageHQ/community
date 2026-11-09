import { z } from "zod";

import { MEMBER_ERROR_CODES } from "../members/contract-linkedin.ts";
import { REQUEST_ERROR_CODES } from "../../platform/http/error-codes.ts";
import { VILLAGE_ERROR_CODES } from "../../platform/village/error-codes.ts";
import { CREDIT_CALL_KINDS, ESTIMATED_CREDITS, USD_PER_CREDIT } from "../../platform/village/contract.ts";

export const CONNECTOR_LIMITS = { nameLength: 200, headlineLength: 300, reasonLength: 600 } as const;

export const CONNECTOR_ERROR_CODES = { ownTarget: "intro_own_target" } as const;

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
  fillInOff: "fill_in_off",
  fillInTooSoon: "fill_in_too_soon",
  nudgeTooSoon: "nudge_too_soon",
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
  sync: z.object({ appUrl: z.string() }).nullable(),
});

export type NetworkStatus = z.infer<typeof networkStatusSchema>;
export type NetworkStage = NetworkStatus["stage"];

export const syncTokenSchema = z.object({ token: z.string() });

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
  openAsk: z.object({ id: z.uuid(), state: z.string() }).nullable(),
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

export { USD_PER_CREDIT };

export const CREDITS_PER_PATH_LOOKUP = ESTIMATED_CREDITS[CREDIT_CALL_KINDS.path];

export const CREDITS_PER_FULL_SEARCH = ESTIMATED_CREDITS[CREDIT_CALL_KINDS.search];

export const departureResponseSchema = z.object({ message: z.string(), isGroupLeaveIncomplete: z.boolean() });

export function isDepartureIncomplete(outcome: GroupDepartureOutcome | null) {
  return outcome === GROUP_DEPARTURE_OUTCOMES.failed || outcome === GROUP_DEPARTURE_OUTCOMES.creatorRefused;
}

export type GroupDepartureOutcome = (typeof GROUP_DEPARTURE_OUTCOMES)[keyof typeof GROUP_DEPARTURE_OUTCOMES];

export type VillageStatus = (typeof VILLAGE_STATUSES)[keyof typeof VILLAGE_STATUSES];
