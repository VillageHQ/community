import { z } from "zod";

export const MEMBER_ROLES = { admin: "admin", member: "user" } as const;
export const CONTENT_CHOICES = { keep: "keep", delete: "delete" } as const;
export const MEMBER_FILTERS = { all: "all", admins: "admins", attention: "attention", removed: "removed" } as const;
export const VILLAGE_STATUSES = {
  notShared: "not_shared",
  sharing: "sharing",
  syncing: "syncing",
  ready: "ready",
  blocked: "blocked",
} as const;

export const REPORT_TARGETS = {
  directMessage: "direct_message",
  post: "post",
  comment: "comment",
  introNote: "intro_note",
} as const;
export const FEED_REPORT_TARGETS = { post: REPORT_TARGETS.post, comment: REPORT_TARGETS.comment } as const;
export const REPORT_RESOLUTIONS = {
  dismissed: "dismissed",
  contentDeleted: "content_deleted",
  memberRemoved: "member_removed",
} as const;
export const REPORT_FILTERS = { open: "open", resolved: "resolved" } as const;

export const AUDIT_ACTIONS = {
  rolePromoted: "role_promoted",
  roleDemoted: "role_demoted",
  memberRemoved: "member_removed",
  memberUnbanned: "member_unbanned",
  emailConfirmed: "email_confirmed",
  villageLinkApproved: "village_link_approved",
  villageLinkReset: "village_link_reset",
  linkedinConfirmed: "linkedin_confirmed",
  linkedinCleared: "linkedin_cleared",
  inviteCreated: "invite_created",
  inviteResent: "invite_resent",
  inviteRevoked: "invite_revoked",
  inviteReclaimed: "invite_reclaimed",
  reportDismissed: "report_dismissed",
  reportedContentDeleted: "reported_content_deleted",
  postPinned: "post_pinned",
  postUnpinned: "post_unpinned",
  dailyLimitChanged: "daily_limit_changed",
  villageKeysSaved: "village_keys_saved",
  villageGroupCreated: "village_group_created",
  brandingSaved: "branding_saved",
  logoSaved: "logo_saved",
  logoRemoved: "logo_removed",
  villageGroupLeft: "village_group_left",
  memberReinvited: "member_reinvited",
  passwordReset: "password_reset",
  adminPasswordRecovered: "admin_password_recovered",
  domainConfirmed: "domain_confirmed",
} as const;
export const GROUP_DEPARTURE_OUTCOMES = { left: "left", creatorRefused: "creator_refused", failed: "failed" } as const;
export const AUDIT_KINDS = { action: "action", postDeleted: "post_deleted", commentDeleted: "comment_deleted" } as const;

export const ADMIN_ERROR_CODES = {
  ownAccount: "admin_own_account",
  lastAdmin: "admin_last_admin",
  emailNotConfirmed: "admin_email_not_confirmed",
  memberChanged: "admin_member_changed",
  accountReclaimed: "admin_account_reclaimed",
  reportHandled: "admin_report_handled",
  contentGone: "admin_content_gone",
  notDeletable: "admin_content_not_deletable",
} as const;

export const ADMIN_PAGE_SIZES = { members: 12, reports: 10, auditEntries: 20 } as const;
export const DAILY_LOOKUP_LIMITS = { default: 50, minimum: 1, maximum: 500 } as const;
export const USD_PER_CREDIT = 0.02;
export const CREDITS_PER_PATH_LOOKUP = 5;
export const CREDITS_PER_FULL_SEARCH = 11;
export const MAXIMUM_SEARCH_LENGTH = 200;

const timestampSchema = z.iso.datetime();
const pageSchema = z.number().int().min(1).default(1);
const searchSchema = z.string().trim().max(MAXIMUM_SEARCH_LENGTH).default("");

export const memberListBodySchema = z.object({
  search: searchSchema,
  filter: z.enum(MEMBER_FILTERS).default(MEMBER_FILTERS.all),
  page: pageSchema,
});
export const setMemberRoleBodySchema = z.object({ memberId: z.string().min(1), role: z.enum(MEMBER_ROLES) });
export const removeMemberBodySchema = z.object({
  memberId: z.string().min(1),
  contentChoice: z.enum(CONTENT_CHOICES, "Choose what happens to their posts and replies."),
});
export const adminMemberIdBodySchema = z.object({ memberId: z.string().min(1) });

export const reportListBodySchema = z.object({ filter: z.enum(REPORT_FILTERS).default(REPORT_FILTERS.open), page: pageSchema });
export const reportActionBodySchema = z.object({ reportId: z.uuid(), targetType: z.enum(REPORT_TARGETS) });
export const feedReportBodySchema = z.object({ targetType: z.enum(FEED_REPORT_TARGETS), targetId: z.uuid() });
export const introReportBodySchema = z.object({ introId: z.uuid() });

export const auditLogBodySchema = z.object({ page: pageSchema });

export const dailyLimitBodySchema = z.object({
  limit: z
    .number("Enter a whole number.")
    .int("Enter a whole number.")
    .min(DAILY_LOOKUP_LIMITS.minimum, `Use at least ${DAILY_LOOKUP_LIMITS.minimum} lookup a day.`)
    .max(DAILY_LOOKUP_LIMITS.maximum, `Use ${DAILY_LOOKUP_LIMITS.maximum} lookups a day or fewer.`),
});

const adminMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isAdmin: z.boolean(),
  joinedAt: timestampSchema,
  isEmailConfirmed: z.boolean(),
  isRemoved: z.boolean(),
  isReclaimed: z.boolean(),
  removedAt: timestampSchema.nullable(),
  removalContentChoice: z.enum(CONTENT_CHOICES).nullable(),
  inviteId: z.string().nullable(),
  villageStatus: z.enum(VILLAGE_STATUSES),
  hasVillageLink: z.boolean(),
  pendingVillageEmail: z.string().nullable(),
  isInVillageGroup: z.boolean(),
  hasStaleVillageMembership: z.boolean(),
  villageLeaveOutcome: z.enum(GROUP_DEPARTURE_OUTCOMES).nullable(),
  linkedinUrl: z.string().nullable(),
  isLinkedinConfirmed: z.boolean(),
});

export const memberPageSchema = z.object({
  members: z.array(adminMemberSchema),
  page: z.number(),
  pageCount: z.number(),
  matchCount: z.number(),
  counts: z.record(z.enum(MEMBER_FILTERS), z.number()),
});

const reportedMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  isAdmin: z.boolean(),
  isRemoved: z.boolean(),
  isInVillageGroup: z.boolean(),
});

const reportSchema = z.object({
  id: z.uuid(),
  targetType: z.enum(REPORT_TARGETS),
  body: z.string(),
  contentCreatedAt: timestampSchema,
  createdAt: timestampSchema,
  reporterName: z.string().nullable(),
  reportedMemberName: z.string().nullable(),
  reportedMember: reportedMemberSchema.nullable(),
  isContentGone: z.boolean(),
  resolution: z.enum(REPORT_RESOLUTIONS).nullable(),
  resolvedAt: timestampSchema.nullable(),
  resolvedByName: z.string().nullable(),
});

export const reportPageSchema = z.object({
  reports: z.array(reportSchema),
  page: z.number(),
  pageCount: z.number(),
  counts: z.record(z.enum(REPORT_FILTERS), z.number()),
});

const auditEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(AUDIT_KINDS),
  action: z.enum(AUDIT_ACTIONS).nullable(),
  actorId: z.string().nullable(),
  actorName: z.string(),
  targetName: z.string().nullable(),
  detail: z.string().nullable(),
  removedText: z.string().nullable(),
  removedReplyCount: z.number(),
  createdAt: timestampSchema,
});

export const auditPageSchema = z.object({
  entries: z.array(auditEntrySchema),
  page: z.number(),
  pageCount: z.number(),
  entryCount: z.number(),
});

export const departureResponseSchema = z.object({ message: z.string(), isGroupLeaveIncomplete: z.boolean() });

export function isDepartureIncomplete(outcome: GroupDepartureOutcome | null) {
  return outcome === GROUP_DEPARTURE_OUTCOMES.failed || outcome === GROUP_DEPARTURE_OUTCOMES.creatorRefused;
}

export type MemberFilter = (typeof MEMBER_FILTERS)[keyof typeof MEMBER_FILTERS];
export type GroupDepartureOutcome = (typeof GROUP_DEPARTURE_OUTCOMES)[keyof typeof GROUP_DEPARTURE_OUTCOMES];
export type ContentChoice = (typeof CONTENT_CHOICES)[keyof typeof CONTENT_CHOICES];
export type VillageStatus = (typeof VILLAGE_STATUSES)[keyof typeof VILLAGE_STATUSES];
export type ReportTarget = (typeof REPORT_TARGETS)[keyof typeof REPORT_TARGETS];
export type ReportFilter = (typeof REPORT_FILTERS)[keyof typeof REPORT_FILTERS];
export type ReportResolution = (typeof REPORT_RESOLUTIONS)[keyof typeof REPORT_RESOLUTIONS];
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
export type AdminMember = z.infer<typeof adminMemberSchema>;
export type MemberPage = z.infer<typeof memberPageSchema>;
export type Report = z.infer<typeof reportSchema>;
export type ReportPage = z.infer<typeof reportPageSchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type AuditPage = z.infer<typeof auditPageSchema>;
export type MemberListBody = z.infer<typeof memberListBodySchema>;
export type SetMemberRoleBody = z.infer<typeof setMemberRoleBodySchema>;
export type RemoveMemberBody = z.infer<typeof removeMemberBodySchema>;
export type ReportActionBody = z.infer<typeof reportActionBodySchema>;
export type FeedReportBody = z.infer<typeof feedReportBodySchema>;
