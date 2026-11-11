import "server-only";

import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { OUTBOX_STATUSES } from "../../platform/email/outbox.ts";
import { emailOutbox } from "../../platform/email/schema.ts";
import { invite } from "./schema.ts";
import { INVITE_EMAIL_STATUSES } from "./contract-invite-state.ts";
import { OPEN_INVITE } from "./service-invites.ts";

// Set up › Sign-in links (Founderhall's links page): the open invites a person can only get by hand. With mail off,
// every open invite; with mail on, those whose email failed or was never sent (an import with email off).
// Only the hash of an invite token is kept, so the page shows no link until the admin makes a new one (Copy).
export const WAITING_LINKS_LIMIT = 200;

export type WaitingInviteLink = { id: string; email: string; createdAt: Date; expiresAt: Date };

const NOT_EMAILED = or(
  isNull(invite.emailOutboxId),
  eq(invite.emailStatus, INVITE_EMAIL_STATUSES.failed),
  inArray(emailOutbox.status, [OUTBOX_STATUSES.failed, OUTBOX_STATUSES.skipped]),
);

export async function readWaitingInviteLinks(database: Database, { isMailOn, now = new Date() }: { isMailOn: boolean; now?: Date }): Promise<WaitingInviteLink[]> {
  return database
    .select({ id: invite.id, email: invite.email, createdAt: invite.createdAt, expiresAt: invite.expiresAt })
    .from(invite)
    .leftJoin(emailOutbox, eq(emailOutbox.id, invite.emailOutboxId))
    .where(and(OPEN_INVITE, gt(invite.expiresAt, now), isMailOn ? NOT_EMAILED : undefined))
    .orderBy(desc(invite.createdAt), desc(invite.id))
    .limit(WAITING_LINKS_LIMIT);
}
