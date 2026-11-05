import { z } from "zod";

import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from "../../platform/auth/password-policy.ts";
import { removeNullBytes } from "../../platform/text/safe-text.ts";
import { INVITE_EMAIL_STATUSES, INVITE_STATES } from "./invite-state.ts";
import { nameSchema } from "../../platform/auth/member-name.ts";
const MAXIMUM_EMAIL_LENGTH = 254;

export const INVITE_ERROR_CODES = {
  alreadyMember: "invite_already_member",
  alreadyPending: "invite_already_pending",
  changed: "invite_changed",
  invalidLink: "invite_invalid_link",
  unusable: "invite_unusable",
  signedIn: "invite_signed_in",
  rateLimited: "invite_rate_limited",
} as const;

export const createInviteBodySchema = z.object({
  email: z
    .string()
    .trim()
    .max(MAXIMUM_EMAIL_LENGTH, "This email address is too long.")
    .pipe(z.email("Enter a valid email address."))
    .transform((email) => email.toLowerCase()),
});

export const inviteIdBodySchema = z.object({ inviteId: z.uuid("This invite changed. Reload the page.") });

export const INVITE_FILTERS = {
  all: "all",
  pending: INVITE_STATES.pending,
  accepted: INVITE_STATES.accepted,
  expired: INVITE_STATES.expired,
  revoked: INVITE_STATES.revoked,
} as const;

export type InviteFilter = (typeof INVITE_FILTERS)[keyof typeof INVITE_FILTERS];

export const inviteListBodySchema = z.object({
  page: z.number().int().min(1).default(1),
  filter: z
    .enum([
      INVITE_FILTERS.all,
      INVITE_FILTERS.pending,
      INVITE_FILTERS.accepted,
      INVITE_FILTERS.expired,
      INVITE_FILTERS.revoked,
    ])
    .default(INVITE_FILTERS.all),
});

export const acceptTokenBodySchema = z.object({ token: z.string() });

export const acceptFieldsBodySchema = z.object({
  name: nameSchema,
  password: z
    .string()
    .min(MINIMUM_PASSWORD_LENGTH, `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`)
    .max(MAXIMUM_PASSWORD_LENGTH, `Use at most ${MAXIMUM_PASSWORD_LENGTH} characters.`),
});

const inviteStateSchema = z.enum([
  INVITE_STATES.pending,
  INVITE_STATES.accepted,
  INVITE_STATES.expired,
  INVITE_STATES.revoked,
]);

const inviteEmailStatusSchema = z.enum([
  INVITE_EMAIL_STATUSES.notSent,
  INVITE_EMAIL_STATUSES.sent,
  INVITE_EMAIL_STATUSES.failed,
]);

export const inviteSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  state: inviteStateSchema,
  emailStatus: inviteEmailStatusSchema,
  invitedByName: z.string(),
  acceptedUserId: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
});

export type InviteSummary = z.infer<typeof inviteSummarySchema>;

export const inviteListSchema = z.object({
  invites: z.array(inviteSummarySchema),
  page: z.number(),
  pageCount: z.number(),
  matchCount: z.number(),
  counts: z.object({
    all: z.number(),
    pending: z.number(),
    accepted: z.number(),
    expired: z.number(),
    revoked: z.number(),
  }),
});

export type InviteList = z.infer<typeof inviteListSchema>;

export const issuedInviteSchema = z.object({
  invite: inviteSummarySchema,
  link: z.string(),
  message: z.string(),
});

export type IssuedInvite = z.infer<typeof issuedInviteSchema>;

export const acceptedInviteSchema = z.object({ isSignedIn: z.boolean() });

export const memberIdBodySchema = z.object({
  memberId: z.string().overwrite(removeNullBytes).min(1, "This member changed. Reload the page."),
});

export const linkedinClaimBodySchema = z.object({
  linkedinUrl: z.string().overwrite(removeNullBytes).trim().min(1, "Paste the LinkedIn profile URL."),
});

export const waitingMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  inviteId: z.string().nullable(),
});

export type WaitingMember = z.infer<typeof waitingMemberSchema>;

export const waitingMembersSchema = z.object({ members: z.array(waitingMemberSchema), waitingCount: z.number() });
