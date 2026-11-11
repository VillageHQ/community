import "server-only";

import { and, eq } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { DatabaseOrTransaction } from "../../platform/database/client.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { MEMBER_ROLES } from "../../platform/auth/roles.ts";
import { EMAIL_KINDS } from "../../platform/email/kinds.ts";
import { queueEmail, readEmailBranding } from "../../platform/email/outbox.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { ROUTES } from "../../platform/http/routes.ts";
import { renderDeletionRequestEmail } from "./email-deletion-request.ts";
import { memberDeletionRequest } from "./schema.ts";

// Founderhall's Members filter for these requests ("Asked to delete").
export const DELETION_REQUEST_FILTER = "delete";

export async function readDeletionRequestedAt(database: DatabaseOrTransaction, memberId: string) {
  const [row] = await database.select({ requestedAt: memberDeletionRequest.requestedAt }).from(memberDeletionRequest).where(eq(memberDeletionRequest.userId, memberId));
  return row?.requestedAt ?? null;
}

// "Ask to delete my account": saved once, and each admin gets one email in the same transaction. Asking again
// changes nothing and sends nothing.
export async function requestAccountDeletion(context: RequestContext) {
  const { database, environment, member } = context;
  const branding = await readEmailBranding(database, environment);
  return database.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(memberDeletionRequest)
      .values({ userId: member.id })
      .onConflictDoNothing()
      .returning({ requestedAt: memberDeletionRequest.requestedAt });
    if (!created) return (await readDeletionRequestedAt(transaction, member.id)) ?? new Date();
    if (branding) {
      const [asker] = await transaction.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, member.id));
      const admins = await transaction.select({ id: user.id, email: user.email }).from(user).where(and(eq(user.role, MEMBER_ROLES.admin), isActiveMember()));
      const email = renderDeletionRequestEmail({
        memberName: asker?.name ?? "",
        memberEmail: asker?.email ?? "",
        communityName: branding.name,
        membersLink: `${resolveAppUrl(environment)}${ROUTES.adminMembers}?f=${DELETION_REQUEST_FILTER}`,
      });
      for (const admin of admins) {
        if (admin.id === member.id) continue;
        await queueEmail(transaction, environment, { kind: EMAIL_KINDS.deletionRequest, to: admin.email, memberId: admin.id, ...email, dedupeKey: `deletion-request:${member.id}:${admin.id}` });
      }
    }
    return created.requestedAt;
  });
}
