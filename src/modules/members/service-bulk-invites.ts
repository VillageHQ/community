import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Transaction } from "../../platform/database/client.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminActions } from "../../platform/audit/record.ts";
import { readEmailBranding, type EmailBranding } from "../../platform/email/outbox.ts";
import { sendQueuedEmailsSoon } from "../../platform/email/outbox-sender.ts";
import { type RequestContext } from "../../platform/http/request-context.ts";
import { invite } from "./schema.ts";
import { INVITE_STATES, readInviteExpiry, readInviteState } from "./contract-invite-state.ts";
import { type BulkInviteResult, type BulkPerson, type BulkSkip, type ParsedBulkInvites } from "./contract-bulk-invites.ts";
import { createInviteToken, hashInviteToken } from "./service-invite-token.ts";
import { OPEN_INVITE, queueInviteEmail, readInviter, toInviteLink } from "./service-invites.ts";

const CHUNK_SIZE = 500;
const BULK_AUDIT_DETAIL = "From a list";
const ALREADY_MEMBER = "Already a member. Nothing changed.";
const ALREADY_PENDING = "Already has a pending invite. Use Resend in the list if they lost it.";

type IssuedInvite = { email: string; name: string | null; token: string; isRenewed: boolean };
type Inviter = { id: string; name: string };

function chunk<Item>(items: Item[], size: number) {
  const chunks: Item[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
}

function toInviteValues(person: BulkPerson, inviter: Inviter, token: string) {
  return {
    email: person.email,
    inviteeName: person.name,
    company: person.company,
    cohort: person.cohort,
    tokenHash: hashInviteToken(token),
    invitedByUserId: inviter.id,
    invitedByName: inviter.name,
    expiresAt: readInviteExpiry(),
  };
}

type ChunkContext = { request: RequestContext; inviter: Inviter; branding: EmailBranding | null };

async function inviteChunk(transaction: Transaction, { request, inviter, branding }: ChunkContext, people: BulkPerson[]) {
  const emails = people.map(({ email }) => email);
  const members = await transaction.select({ email: user.email }).from(user).where(inArray(user.email, emails));
  const memberEmails = new Set(members.map(({ email }) => email));
  const openInvites = await transaction.select().from(invite).where(and(inArray(invite.email, emails), OPEN_INVITE)).for("update");
  const openByEmail = new Map(openInvites.map((row) => [row.email, row]));

  const skipped: BulkSkip[] = [];
  const issued: IssuedInvite[] = [];
  const fresh: { person: BulkPerson; token: string }[] = [];

  for (const person of people) {
    if (memberEmails.has(person.email)) {
      skipped.push({ line: person.line, email: person.email, why: ALREADY_MEMBER });
      continue;
    }
    const open = openByEmail.get(person.email);
    if (open && readInviteState(open) !== INVITE_STATES.expired) {
      skipped.push({ line: person.line, email: person.email, why: ALREADY_PENDING });
      continue;
    }
    const token = createInviteToken();
    if (!open) {
      fresh.push({ person, token });
      continue;
    }
    const [renewed] = await transaction.update(invite).set(toInviteValues(person, inviter, token)).where(eq(invite.id, open.id)).returning();
    if (!renewed) continue;
    await queueInviteEmail(transaction, request, branding, renewed, token);
    issued.push({ email: person.email, name: person.name, token, isRenewed: true });
  }

  if (fresh.length > 0) {
    const tokenByEmail = new Map(fresh.map(({ person, token }) => [person.email, token]));
    const created = await transaction
      .insert(invite)
      .values(fresh.map(({ person, token }) => toInviteValues(person, inviter, token)))
      .onConflictDoNothing({ target: invite.email, where: OPEN_INVITE })
      .returning();
    const createdEmails = new Set(created.map(({ email }) => email));
    for (const { person } of fresh) {
      if (!createdEmails.has(person.email)) skipped.push({ line: person.line, email: person.email, why: ALREADY_PENDING });
    }
    for (const row of created) {
      const token = tokenByEmail.get(row.email) ?? "";
      await queueInviteEmail(transaction, request, branding, row, token);
      issued.push({ email: row.email, name: row.inviteeName, token, isRenewed: false });
    }
  }

  await recordAdminActions(
    transaction,
    inviter.id,
    issued.map(({ email, isRenewed }) => ({
      action: isRenewed ? AUDIT_ACTIONS.inviteResent : AUDIT_ACTIONS.inviteCreated,
      targetName: email,
      detail: BULK_AUDIT_DETAIL,
    })),
  );
  return { issued, skipped };
}

// Each person gets the same single-use 14-day invite as one invited by hand. Members and pending invites are
// skipped and named; an expired invite is renewed. Each email is queued in the transaction that issues its invite,
// so none is lost; the outbox sends them and retries a failed one.
export async function createBulkInvites(context: RequestContext, parsed: ParsedBulkInvites): Promise<BulkInviteResult> {
  const inviter = await readInviter(context);
  const branding = await readEmailBranding(context.database, context.environment);
  const chunkContext: ChunkContext = { request: context, inviter, branding };
  const issued: IssuedInvite[] = [];
  const skipped = [...parsed.skipped];

  for (const people of chunk(parsed.people, CHUNK_SIZE)) {
    const result = await withAdminTransaction(context.database, context.member.id, (transaction) => inviteChunk(transaction, chunkContext, people));
    issued.push(...result.issued);
    skipped.push(...result.skipped);
  }

  const isEmailOn = branding !== null;
  if (isEmailOn && issued.length > 0) sendQueuedEmailsSoon(context.database, context.environment);

  const renewedCount = issued.filter(({ isRenewed }) => isRenewed).length;
  return {
    invitedCount: issued.length - renewedCount,
    renewedCount,
    problems: parsed.problems,
    skipped: skipped.sort((first, second) => first.line - second.line),
    isEmailOn,
    links: isEmailOn ? [] : issued.map(({ email, name, token }) => ({ email, name, link: toInviteLink(context.environment, token) })),
  };
}
