export const INVITE_STATES = {
  pending: "pending",
  accepted: "accepted",
  expired: "expired",
  revoked: "revoked",
} as const;

export type InviteState = (typeof INVITE_STATES)[keyof typeof INVITE_STATES];

export const INVITE_EMAIL_STATUSES = { notSent: "not_sent", sent: "sent", failed: "failed" } as const;

export type InviteEmailStatus = (typeof INVITE_EMAIL_STATUSES)[keyof typeof INVITE_EMAIL_STATUSES];

const INVITE_EMAIL_STATUS_VALUES: readonly InviteEmailStatus[] = Object.values(INVITE_EMAIL_STATUSES);

export function parseInviteEmailStatus(value: string): InviteEmailStatus {
  return INVITE_EMAIL_STATUS_VALUES.find((status) => status === value) ?? INVITE_EMAIL_STATUSES.notSent;
}

export const INVITE_LIFETIME_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type InviteDates = { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date };

export function readInviteState({ acceptedAt, revokedAt, expiresAt }: InviteDates, now = new Date()): InviteState {
  if (revokedAt) return INVITE_STATES.revoked;
  if (acceptedAt) return INVITE_STATES.accepted;
  return expiresAt <= now ? INVITE_STATES.expired : INVITE_STATES.pending;
}

export function readInviteExpiry(now = new Date()) {
  return new Date(now.getTime() + INVITE_LIFETIME_DAYS * MS_PER_DAY);
}
