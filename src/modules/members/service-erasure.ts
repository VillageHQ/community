import "server-only";

import { eq, like, or, sql } from "drizzle-orm";

import { account, session, user, verification } from "../../platform/database/auth-schema.ts";
import type { Transaction } from "../../platform/database/client.ts";
import { RECLAIMED_EMAIL_DOMAIN } from "../../platform/auth/reclaimed-email.ts";
import { MEMBER_ROLES } from "../../platform/auth/roles.ts";
import { toContainsPattern } from "./reads-directory.ts";
import { DELETED_MEMBER_NAME } from "./contract-privacy.ts";
import {
  invite,
  memberAvatar,
  memberBlock,
  memberFillIn,
  memberLookup,
  memberNetwork,
  memberPrivacy,
  memberProfile,
  memberRemoval,
  memberTag,
} from "./schema.ts";

export const ERASED_BAN_REASON = "This account was deleted.";

export type ErasureFacts = { memberId: string; name: string; email: string; role: string | null; linkedinSlugs: string[] };

// What the delete needs to know before anything goes: who they are, and every LinkedIn address that was theirs.
export async function readErasureFacts(transaction: Transaction, memberId: string): Promise<ErasureFacts | null> {
  const [row] = await transaction
    .select({
      name: user.name,
      email: user.email,
      role: user.role,
      linkedinSlug: memberNetwork.linkedinSlug,
      linkedinConfirmedSlug: memberNetwork.linkedinConfirmedSlug,
      erasedAt: memberRemoval.erasedAt,
    })
    .from(user)
    .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
    .leftJoin(memberRemoval, eq(memberRemoval.userId, user.id))
    .where(eq(user.id, memberId))
    .for("update", { of: user });
  if (!row || row.erasedAt) return null;
  const linkedinSlugs = [...new Set([row.linkedinSlug, row.linkedinConfirmedSlug].filter((slug): slug is string => Boolean(slug)))];
  return { memberId, name: row.name, email: row.email.toLowerCase(), role: row.role, linkedinSlugs };
}

export function toErasedEmail(memberId: string) {
  return `deleted-${memberId}@${RECLAIMED_EMAIL_DOMAIN}`;
}

type Erasure = { facts: ErasureFacts; actorId: string; villageLeaveOutcome: string | null; villageCancelOutcome: string | null };

// The member's own rows in this module, and the account itself. The user row stays as an empty placeholder, because
// intros keep pointing at it for the partner report: no name, no email, no way to sign in, and it can't come back.
export async function eraseMemberAccount(transaction: Transaction, { facts, actorId, villageLeaveOutcome, villageCancelOutcome }: Erasure) {
  const { memberId, email } = facts;
  await transaction.delete(memberProfile).where(eq(memberProfile.userId, memberId));
  await transaction.delete(memberTag).where(eq(memberTag.userId, memberId));
  await transaction.delete(memberAvatar).where(eq(memberAvatar.userId, memberId));
  await transaction.delete(memberFillIn).where(eq(memberFillIn.userId, memberId));
  await transaction.delete(memberLookup).where(eq(memberLookup.userId, memberId));
  await transaction.delete(memberPrivacy).where(eq(memberPrivacy.userId, memberId));
  await transaction.delete(memberBlock).where(or(eq(memberBlock.blockerId, memberId), eq(memberBlock.blockedId, memberId)));
  await transaction.delete(memberNetwork).where(eq(memberNetwork.userId, memberId));

  // Invites to their email (the one they used and any still open), and their name on invites they sent.
  await transaction.delete(invite).where(or(eq(invite.email, email), eq(invite.acceptedUserId, memberId)));
  await transaction.update(invite).set({ invitedByName: DELETED_MEMBER_NAME }).where(eq(invite.invitedByUserId, memberId));

  await transaction.delete(session).where(eq(session.userId, memberId));
  await transaction.delete(account).where(eq(account.userId, memberId));
  await transaction
    .delete(verification)
    .where(
      or(like(verification.identifier, toContainsPattern(memberId)), eq(verification.value, memberId), matchesWord(verification.identifier, readEmailPattern(email)), matchesWord(verification.value, readEmailPattern(email))),
    );

  await transaction
    .update(user)
    .set({
      name: DELETED_MEMBER_NAME,
      email: toErasedEmail(memberId),
      emailVerified: false,
      image: null,
      role: MEMBER_ROLES.member,
      banned: true,
      banReason: ERASED_BAN_REASON,
      banExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, memberId));

  const removal = { keepsContent: false, removedByUserId: actorId, removedAt: new Date(), erasedAt: new Date(), villageLeaveOutcome, villageCancelOutcome };
  await transaction.insert(memberRemoval).values({ userId: memberId, ...removal }).onConflictDoUpdate({ target: memberRemoval.userId, set: removal });
}

// Words of a name, for a whole-word match in other tables. A name shorter than this matches too much to be safe.
const MINIMUM_NAME_LENGTH = 3;

export function readNamePattern(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < MINIMUM_NAME_LENGTH || trimmed === DELETED_MEMBER_NAME) return null;
  return `\\m${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\M`;
}

// The whole address only: "dana@example.com" must never match inside "adana@example.com" or "dana@example.com.au".
export function readEmailPattern(email: string) {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `(?<![a-z0-9._%+-])${escaped}(?![a-z0-9-]|\\.[a-z0-9])`;
}

export function matchesWord(column: Parameters<typeof sql>[1], pattern: string) {
  return sql<boolean>`${column} ~* ${pattern}`;
}
