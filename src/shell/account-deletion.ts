import "server-only";

import { eq, ilike, like, or, sql } from "drizzle-orm";

import { contentReport } from "@/modules/admin/schema";
import { REPORT_RESOLUTIONS } from "@/modules/admin/contract";
import { resolveOpenReportsAgainstMember } from "@/modules/admin/service-report-resolution";
import { lockAdminRoster, requireAnotherAdmin } from "@/modules/admin/service-roster";
import { eraseMemberAsks } from "@/modules/asks/service-erasure";
import { ask } from "@/modules/asks/schema";
import { eraseMemberFeed, ERASED_TEXT } from "@/modules/feed/service-erasure";
import { anonymizeMemberIntros } from "@/modules/intros/service-erasure";
import { introRequest } from "@/modules/intros/schema";
import { DELETED_MEMBER_NAME } from "@/modules/members/contract-privacy";
import { eraseMemberAccount, matchesWord, readErasureFacts, readNamePattern, type ErasureFacts } from "@/modules/members/service-erasure";
import { toContainsPattern } from "@/modules/members/reads-directory";
import { eraseMemberMessages } from "@/modules/messages/service-erasure";
import { messageReport } from "@/modules/messages/schema";
import { memberConnectNudge, memberPathResult } from "@/modules/network/schema";
import { eraseFromVillage, VILLAGE_CANCEL_OUTCOMES, type VillageErasure } from "@/modules/network/service-erasure";
import { DEPARTURE_SENTENCES } from "@/modules/network/service-departure";
import { GROUP_DEPARTURE_OUTCOMES } from "@/modules/network/contract";
import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { requireCurrentAdmin } from "@/platform/audit/admin-transaction";
import { recordAdminAction } from "@/platform/audit/record";
import { adminAuditEntry } from "@/platform/audit/schema";
import { MEMBER_ROLES } from "@/platform/auth/roles";
import { rateLimit, user } from "@/platform/database/auth-schema";
import type { Transaction } from "@/platform/database/client";
import { emailOptOut, emailOutbox, emailSuppression } from "@/platform/email/schema";
import { RequestError } from "@/platform/http/request-error";
import type { RequestContext } from "@/platform/http/request-context";
import { memberDailyUsage } from "@/platform/village/schema";
import { weeklyEmail, type WeeklyEmailItem } from "@/platform/weekly-email/schema";

const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const ERASED_EMAIL_TEXT = "[deleted]";
const ERASED_ITEM_TITLE = "(deleted)";

export const DELETION_ACTORS = { self: "self", admin: "admin" } as const;
type DeletionActor = (typeof DELETION_ACTORS)[keyof typeof DELETION_ACTORS];

function accountGoneError() {
  return new RequestError(NOT_FOUND_STATUS, "account_not_found", "This account is already gone. Reload the page.");
}

function ownAccountError() {
  return new RequestError(CONFLICT_STATUS, "own_account", "To delete your own account, use Your data.");
}

// Others' weekly emails list items by title. An item about one of the member's asks or intros, or naming them,
// keeps its number (so an answer to it still does nothing twice) and loses its words.
async function scrubWeeklyItems(transaction: Transaction, facts: ErasureFacts, refs: ReadonlySet<string>, namePattern: string | null) {
  await transaction.delete(weeklyEmail).where(eq(weeklyEmail.memberId, facts.memberId));
  const rows = await transaction.select({ id: weeklyEmail.id, items: weeklyEmail.items }).from(weeklyEmail);
  const nameMatcher = namePattern ? new RegExp(namePattern.replaceAll("\\m", "\\b").replaceAll("\\M", "\\b"), "i") : null;
  for (const { id, items } of rows) {
    let isChanged = false;
    const scrubbed = items.map((item: WeeklyEmailItem) => {
      if (!refs.has(item.ref) && !(nameMatcher?.test(item.title) ?? false)) return item;
      isChanged = true;
      return { ...item, title: ERASED_ITEM_TITLE };
    });
    if (isChanged) await transaction.update(weeklyEmail).set({ items: scrubbed }).where(eq(weeklyEmail.id, id));
  }
}

// Emails to them, and emails to others that name them. A pending one would only describe something that is gone.
async function deleteOutboxCopies(transaction: Transaction, { memberId, email }: ErasureFacts, namePattern: string | null) {
  const emailPattern = toContainsPattern(email);
  const naming = namePattern ? [matchesWord(emailOutbox.subject, namePattern), matchesWord(emailOutbox.text, namePattern), matchesWord(emailOutbox.html, namePattern)] : [];
  await transaction
    .delete(emailOutbox)
    .where(or(eq(emailOutbox.memberId, memberId), ilike(emailOutbox.toEmail, email), ilike(emailOutbox.text, emailPattern), ilike(emailOutbox.html, emailPattern), ...naming));
}

// Audit and moderation copies keep what happened and when, never who it was or what they wrote.
async function scrubAuditCopies(transaction: Transaction, { memberId, email }: ErasureFacts, namePattern: string | null) {
  await transaction.update(adminAuditEntry).set({ targetName: DELETED_MEMBER_NAME, detail: null }).where(eq(adminAuditEntry.targetMemberId, memberId));
  await transaction.update(adminAuditEntry).set({ actorName: DELETED_MEMBER_NAME }).where(eq(adminAuditEntry.actorId, memberId));
  await transaction.update(adminAuditEntry).set({ detail: null }).where(ilike(adminAuditEntry.detail, toContainsPattern(email)));
  if (namePattern) {
    await transaction.update(adminAuditEntry).set({ detail: null }).where(matchesWord(adminAuditEntry.detail, namePattern));
    await transaction.update(adminAuditEntry).set({ targetName: DELETED_MEMBER_NAME }).where(matchesWord(adminAuditEntry.targetName, namePattern));
  }
  await transaction.update(contentReport).set({ body: ERASED_TEXT }).where(eq(contentReport.reportedMemberId, memberId));
  await transaction.update(contentReport).set({ resolvedByName: DELETED_MEMBER_NAME }).where(eq(contentReport.resolvedByUserId, memberId));
  await transaction.update(messageReport).set({ resolvedByName: DELETED_MEMBER_NAME }).where(eq(messageReport.resolvedByUserId, memberId));
}

// A last sweep for the email address in every text column of every table, for any copy no step above knows about.
async function sweepEmail(transaction: Transaction, email: string) {
  const columns = await transaction.execute<{ table_name: string; column_name: string; data_type: string }>(sql`
    select table_name, column_name, data_type from information_schema.columns
    where table_schema = 'public' and data_type in ('text', 'character varying', 'jsonb') and table_name not like '\\_\\_%'`);
  const pattern = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const contains = toContainsPattern(email);
  for (const { table_name: table, column_name: column, data_type: type } of columns.rows) {
    const target = sql.identifier(column);
    const replaced =
      type === "jsonb"
        ? sql`regexp_replace(${target}::text, ${pattern}, ${ERASED_EMAIL_TEXT}, 'gi')::jsonb`
        : sql`regexp_replace(${target}, ${pattern}, ${ERASED_EMAIL_TEXT}, 'gi')`;
    const haystack = type === "jsonb" ? sql`${target}::text` : target;
    await transaction.execute(sql`update ${sql.identifier(table)} set ${target} = ${replaced} where ${haystack} ilike ${contains}`);
  }
}

async function eraseEverything(transaction: Transaction, facts: ErasureFacts, actorId: string, actor: DeletionActor, village: VillageErasure) {
  const { memberId, email } = facts;
  const namePattern = readNamePattern(facts.name);
  const actorName = actor === DELETION_ACTORS.self ? DELETED_MEMBER_NAME : undefined;

  const [askRows, introRows] = await Promise.all([
    transaction.select({ id: ask.id }).from(ask).where(eq(ask.authorId, memberId)),
    transaction
      .select({ id: introRequest.id })
      .from(introRequest)
      .where(or(eq(introRequest.requesterId, memberId), eq(introRequest.introducerId, memberId))),
  ]);
  const refs = new Set([...askRows, ...introRows].map(({ id }) => id));

  await anonymizeMemberIntros(transaction, facts);
  await eraseMemberAsks(transaction, facts);
  await eraseMemberFeed(transaction, memberId, actorId, actorName ?? (await readActorName(transaction, actorId)));
  await eraseMemberMessages(transaction, memberId);
  await resolveOpenReportsAgainstMember(transaction, memberId, actorId, REPORT_RESOLUTIONS.memberRemoved);

  await transaction.delete(memberPathResult).where(eq(memberPathResult.userId, memberId));
  await transaction.delete(memberConnectNudge).where(eq(memberConnectNudge.userId, memberId));
  await transaction.delete(memberDailyUsage).where(eq(memberDailyUsage.userId, memberId));
  await transaction.delete(emailOptOut).where(eq(emailOptOut.memberId, memberId));
  await transaction.delete(emailSuppression).where(eq(emailSuppression.email, email));
  await transaction.delete(rateLimit).where(or(like(rateLimit.key, toContainsPattern(memberId)), ilike(rateLimit.key, toContainsPattern(email))));
  await scrubWeeklyItems(transaction, facts, refs, namePattern);
  await deleteOutboxCopies(transaction, facts, namePattern);

  await eraseMemberAccount(transaction, {
    facts,
    actorId,
    villageLeaveOutcome: village.groupOutcome,
    villageCancelOutcome: village.cancelOutcome,
  });
  await scrubAuditCopies(transaction, facts, namePattern);
  await sweepEmail(transaction, email);
  await recordAdminAction(transaction, actorId, {
    action: AUDIT_ACTIONS.accountDeleted,
    targetMemberId: memberId,
    targetName: DELETED_MEMBER_NAME,
    detail: `${actor}|${village.cancelOutcome ?? "none"}`,
  });
}

async function readActorName(transaction: Transaction, actorId: string) {
  const [row] = await transaction.select({ name: user.name }).from(user).where(eq(user.id, actorId));
  return row?.name ?? "";
}

function readVillageSentence({ groupOutcome, cancelOutcome }: VillageErasure, isSelf: boolean) {
  const sentences: string[] = [];
  if (groupOutcome && groupOutcome !== GROUP_DEPARTURE_OUTCOMES.left) sentences.push(DEPARTURE_SENTENCES[groupOutcome](isSelf ? "you" : "them"));
  if (cancelOutcome === VILLAGE_CANCEL_OUTCOMES.cancelled) sentences.push("Village was asked to remove the account there too, and did.");
  if (cancelOutcome === VILLAGE_CANCEL_OUTCOMES.failed) {
    sentences.push("We couldn't reach Village to remove the account there. Use Village's removal form to finish that part.");
  }
  return sentences.join(" ");
}

// The real delete, for a member themselves or for an admin acting on a member. Village goes first, while the member's
// Village identity is still known; then everything here goes in one transaction, so a failure leaves nothing half done.
export async function deleteAccount(context: RequestContext, memberId: string, actor: DeletionActor) {
  const { database, member } = context;
  const isSelf = actor === DELETION_ACTORS.self;
  if (isSelf && memberId !== member.id) throw accountGoneError();
  if (!isSelf && memberId === member.id) throw ownAccountError();

  const before = await database.transaction((transaction) => readErasureFacts(transaction, memberId));
  if (!before) throw accountGoneError();
  if (!isSelf) await database.transaction((transaction) => requireCurrentAdmin(transaction, member.id));
  if (before.role === MEMBER_ROLES.admin) {
    await database.transaction(async (transaction) => {
      await lockAdminRoster(transaction);
      await requireAnotherAdmin(transaction);
    });
  }

  const village = await eraseFromVillage(context, { memberId, memberName: before.name, email: before.email });
  await database.transaction(async (transaction) => {
    await lockAdminRoster(transaction);
    if (!isSelf) await requireCurrentAdmin(transaction, member.id);
    const facts = await readErasureFacts(transaction, memberId);
    if (!facts) throw accountGoneError();
    if (facts.role === MEMBER_ROLES.admin) await requireAnotherAdmin(transaction);
    await eraseEverything(transaction, facts, member.id, actor, village);
  });

  const villageSentence = readVillageSentence(village, isSelf);
  const done = isSelf ? "Your account and everything it held are deleted." : "The account and everything it held are deleted.";
  return { message: villageSentence ? `${done} ${villageSentence}` : done, isVillageIncomplete: village.cancelOutcome === VILLAGE_CANCEL_OUTCOMES.failed };
}
