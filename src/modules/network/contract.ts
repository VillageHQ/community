import { z } from "zod";

import { MEMBER_ERROR_CODES } from "../members/contract-linkedin.ts";
import { REQUEST_ERROR_CODES } from "../../platform/http/error-codes.ts";
import { VILLAGE_ERROR_CODES } from "../../platform/village/error-codes.ts";
import { CONNECTOR_ERROR_CODES, CONNECTOR_LIMITS, CREDIT_CALL_KINDS, ESTIMATED_CREDITS, USD_PER_CREDIT } from "../../platform/village/contract.ts";

export { CONNECTOR_ERROR_CODES, CONNECTOR_LIMITS };

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
  fillInRunning: "fill_in_running",
  nudgeTooSoon: "nudge_too_soon",
  pooledSearchUnavailable: "pooled_search_unavailable",
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
  // True when the member can search now: their own network is in, or, before they connect, the community's shared
  // networks are there to search.
  canSearch: z.boolean(),
});

export type NetworkStatus = z.infer<typeof networkStatusSchema>;
export type NetworkStage = NetworkStatus["stage"];

export const syncTokenSchema = z.object({ token: z.string() });

// Where a search looks: the networks members share ("In our network"), or everyone Village knows ("Everywhere").
export const SEARCH_WHERE = { network: "network", global: "global" } as const;
export const searchWhereSchema = z.enum([SEARCH_WHERE.network, SEARCH_WHERE.global]);
export type SearchWhere = z.infer<typeof searchWhereSchema>;
export const SEARCH_SCOPE_PARAM = "scope";

// One way in, through a member who shares their network: who they are, and Village's warmth word ("Close", "Met").
const searchPathSchema = z.object({
  memberId: z.string(),
  name: z.string(),
  // "CTO, Brightwater Logistics"
  about: z.string().nullable(),
  imageUrl: z.string().nullable(),
  linkedinSlug: z.string().nullable(),
  warmth: z.string().nullable(),
});

export type SearchPath = z.infer<typeof searchPathSchema>;

const searchMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  city: z.string().nullable(),
  companyLogoUrl: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export type SearchMember = z.infer<typeof searchMemberSchema>;

export const networkSearchResultSchema = z.object({
  query: z.string(),
  scope: searchWhereSchema,
  people: z.array(
    z.object({
      fullName: z.string(),
      headline: z.string().nullable(),
      linkedinSlug: z.string().nullable(),
      isMember: z.boolean(),
      memberId: z.string().nullable(),
      // A member's own face, else the picture Village has of them.
      imageUrl: z.string().nullable(),
      title: z.string().nullable(),
      company: z.string().nullable(),
      companyLogoUrl: z.string().nullable(),
      city: z.string().nullable(),
      // The searcher knows them first-hand: reach out yourself, no intro and no ask used.
      direct: z.object({ how: z.string().nullable(), warmth: z.string().nullable() }).nullable(),
      // The ways in through members who share, warmest first.
      paths: z.array(searchPathSchema),
    }),
  ),
  // Members matching the search, shown first as "Member" rows.
  members: z.array(searchMemberSchema),
  discardedOffNetworkResults: z.boolean(),
  dailyLookupsLeft: z.number().int(),
  // False before the member connects: the search covered only the networks other members shared.
  includesOwnNetwork: z.boolean(),
  // The same search in the last 10 minutes: no new lookup was spent.
  isCached: z.boolean(),
  // The community hasn't connected Village: only member profiles were searched.
  isProfilesOnly: z.boolean(),
});

export type NetworkSearchResult = z.infer<typeof networkSearchResultSchema>;
export type NetworkPerson = NetworkSearchResult["people"][number];

const pathPersonSchema = z.object({
  name: z.string(),
  linkedinSlug: z.string().nullable(),
  isMember: z.boolean(),
  imageUrl: z.string().nullable(),
});

const connectorSchema = z.object({
  name: z.string(),
  headline: z.string().nullable(),
  linkedinSlug: z.string().nullable(),
  reason: z.string(),
  throughName: z.string().nullable(),
  // The connector's face (a member's own, else Village's picture) and the face of the person they go through.
  imageUrl: z.string().nullable(),
  throughImageUrl: z.string().nullable(),
  member: z.object({ id: z.string(), avatarUrl: z.string().nullable() }).nullable(),
  openAsk: z.object({ id: z.uuid(), state: z.string() }).nullable(),
});

export type Connector = z.infer<typeof connectorSchema>;

export const networkPathsSchema = z.object({
  summary: z.string().nullable(),
  isTargetMember: z.boolean(),
  isCached: z.boolean(),
  targetName: z.string().nullable(),
  targetImageUrl: z.string().nullable(),
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

// Today's "Who do you want to meet?" box sends its words to network search in this parameter.
export const SEARCH_PROMPT_PARAM = "q";
export const SEARCH_PROMPT_MAX_LENGTH = 500;

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
