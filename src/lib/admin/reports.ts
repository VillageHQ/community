import "server-only";

import { and, count, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { alias, unionAll } from "drizzle-orm/pg-core";

import { contentReport } from "../../database/admin-schema.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database, Transaction } from "../../platform/database/client.ts";
import { comment, post } from "../../database/feed-schema.ts";
import { messageReport } from "../../database/messages-schema.ts";
import { memberNetwork } from "../../modules/members/schema.ts";
import { deleteCommentWithin, deletePostWithin } from "../feed/feed-actions.ts";
import { FEED_ERROR_CODES } from "../feed/feed-api.ts";
import { isAuthorVisibleTo, isPostVisible } from "../feed/feed-reads.ts";
import { introGoneError } from "../intros/intro-actions.ts";
import { INTRO_ROLES } from "../intros/intro-api.ts";
import { readIntroForViewer } from "../intros/intro-reads.ts";
import { isBanActive } from "../../platform/auth/member-status.ts";
import { enforceMessagingLimit, MESSAGING_KINDS } from "../messages/sending-limit.ts";
import { NetworkRequestError } from "../../platform/http/request-error.ts";
import { type NetworkContext } from "../../platform/http/request-context.ts";
import {
  ADMIN_ERROR_CODES,
  ADMIN_PAGE_SIZES,
  FEED_REPORT_TARGETS,
  REPORT_FILTERS,
  REPORT_RESOLUTIONS,
  REPORT_TARGETS,
  reportPageSchema,
  type FeedReportBody,
  type ReportActionBody,
  type ReportFilter,
  type ReportPage,
  type ReportResolution,
  type ReportTarget,
} from "./admin-api.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { MEMBER_ROLES } from "../../platform/auth/roles.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { readResolvedFields } from "./report-resolution.ts";

const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;

export const REPORT_SAVED_MESSAGES = {
  saved: "Report sent to this community's admins.",
  alreadyOpen: "You already reported this. It's waiting for an admin.",
  alreadyReviewed: "An admin already reviewed your report on this, so we didn't send it again.",
} as const;

const reporterUser = alias(user, "reporter_user");
const reportedUser = alias(user, "reported_user");

function contentGoneError() {
  return new NetworkRequestError(NOT_FOUND_STATUS, FEED_ERROR_CODES.notFound, "This isn't available anymore.");
}

function ownContentError() {
  return new NetworkRequestError(UNPROCESSABLE_STATUS, FEED_ERROR_CODES.notYours, "You can only report what other members wrote.");
}

type ReportDraft = { targetType: ReportTarget; targetId: string; reportedMemberId: string; body: string; contentCreatedAt: Date };

async function saveReport({ database, member }: NetworkContext, draft: ReportDraft) {
  if (draft.reportedMemberId === member.id) throw ownContentError();
  await enforceMessagingLimit(database, member.id, MESSAGING_KINDS.report);
  const [created] = await database
    .insert(contentReport)
    .values({ ...draft, reporterId: member.id })
    .onConflictDoNothing()
    .returning({ id: contentReport.id });
  if (created) return REPORT_SAVED_MESSAGES.saved;

  const isSameReport = and(
    eq(contentReport.reporterId, member.id),
    eq(contentReport.targetType, draft.targetType),
    eq(contentReport.targetId, draft.targetId),
  );
  const [existing] = await database.select({ body: contentReport.body, resolvedAt: contentReport.resolvedAt }).from(contentReport).where(isSameReport);
  if (!existing?.resolvedAt) return REPORT_SAVED_MESSAGES.alreadyOpen;
  if (existing.body === draft.body) return REPORT_SAVED_MESSAGES.alreadyReviewed;

  await database
    .update(contentReport)
    .set({ body: draft.body, createdAt: new Date(), resolution: null, resolvedAt: null, resolvedByUserId: null, resolvedByName: null })
    .where(isSameReport);
  return REPORT_SAVED_MESSAGES.saved;
}

async function readReportablePost({ database, member }: NetworkContext, targetId: string): Promise<ReportDraft> {
  const [target] = await database
    .select({ authorId: post.authorId, body: post.body, createdAt: post.createdAt })
    .from(post)
    .innerJoin(user, eq(user.id, post.authorId))
    .where(and(eq(post.id, targetId), isAuthorVisibleTo(member)));
  if (!target) throw contentGoneError();
  return { targetType: REPORT_TARGETS.post, targetId, reportedMemberId: target.authorId, body: target.body, contentCreatedAt: target.createdAt };
}

async function readReportableComment({ database, member }: NetworkContext, targetId: string): Promise<ReportDraft> {
  const [target] = await database
    .select({ postId: comment.postId, authorId: comment.authorId, body: comment.body, createdAt: comment.createdAt })
    .from(comment)
    .innerJoin(user, eq(user.id, comment.authorId))
    .where(and(eq(comment.id, targetId), isAuthorVisibleTo(member)));
  if (!target || !(await isPostVisible(database, member, target.postId))) throw contentGoneError();
  return { targetType: REPORT_TARGETS.comment, targetId, reportedMemberId: target.authorId, body: target.body, contentCreatedAt: target.createdAt };
}

const REPORTABLE_FEED_CONTENT = {
  [FEED_REPORT_TARGETS.post]: readReportablePost,
  [FEED_REPORT_TARGETS.comment]: readReportableComment,
};

export async function reportFeedContent(context: NetworkContext, { targetType, targetId }: FeedReportBody) {
  return saveReport(context, await REPORTABLE_FEED_CONTENT[targetType](context, targetId));
}

export async function reportIntroNote(context: NetworkContext, introId: string) {
  const intro = await readIntroForViewer(context.database, context.member.id, introId);
  if (!intro) throw introGoneError();
  if (intro.viewerRole !== INTRO_ROLES.introducer) throw ownContentError();
  return saveReport(context, {
    targetType: REPORT_TARGETS.introNote,
    targetId: introId,
    reportedMemberId: intro.requester.id,
    body: intro.note,
    contentCreatedAt: new Date(intro.createdAt),
  });
}

function selectMessageReports(database: Database) {
  return database
    .select({
      id: messageReport.id,
      targetType: sql<string>`${REPORT_TARGETS.directMessage}`.as("target_type"),
      targetId: sql<string | null>`${messageReport.messageId}`.as("target_id"),
      body: sql<string>`${messageReport.messageBody}`.as("body"),
      contentCreatedAt: sql<string>`${messageReport.messageSentAt}`.as("content_created_at"),
      createdAt: sql<string>`${messageReport.createdAt}`.as("created_at"),
      reporterName: sql<string | null>`${reporterUser.name}`.as("reporter_name"),
      reportedId: sql<string | null>`${reportedUser.id}`.as("reported_id"),
      reportedName: sql<string | null>`${reportedUser.name}`.as("reported_name"),
      reportedRole: sql<string | null>`${reportedUser.role}`.as("reported_role"),
      reportedBanned: sql<boolean | null>`${reportedUser.banned}`.as("reported_banned"),
      reportedBanExpires: sql<string | null>`${reportedUser.banExpires}`.as("reported_ban_expires"),
      reportedInGroup: sql<boolean>`(${memberNetwork.groupJoinedAt} is not null or ${memberNetwork.staleGroupExternalId} is not null)`.as("reported_in_group"),
      resolution: sql<string | null>`${messageReport.resolution}`.as("resolution"),
      resolvedAt: sql<string | null>`${messageReport.resolvedAt}`.as("resolved_at"),
      resolvedByName: sql<string | null>`${messageReport.resolvedByName}`.as("resolved_by_name"),
    })
    .from(messageReport)
    .leftJoin(reporterUser, eq(reporterUser.id, messageReport.reporterId))
    .leftJoin(reportedUser, eq(reportedUser.id, messageReport.reportedMemberId))
    .leftJoin(memberNetwork, eq(memberNetwork.userId, messageReport.reportedMemberId));
}

function selectContentReports(database: Database) {
  return database
    .select({
      id: contentReport.id,
      targetType: sql<string>`${contentReport.targetType}`.as("target_type"),
      targetId: sql<string | null>`${contentReport.targetId}`.as("target_id"),
      body: sql<string>`${contentReport.body}`.as("body"),
      contentCreatedAt: sql<string>`${contentReport.contentCreatedAt}`.as("content_created_at"),
      createdAt: sql<string>`${contentReport.createdAt}`.as("created_at"),
      reporterName: sql<string | null>`${reporterUser.name}`.as("reporter_name"),
      reportedId: sql<string | null>`${reportedUser.id}`.as("reported_id"),
      reportedName: sql<string | null>`${reportedUser.name}`.as("reported_name"),
      reportedRole: sql<string | null>`${reportedUser.role}`.as("reported_role"),
      reportedBanned: sql<boolean | null>`${reportedUser.banned}`.as("reported_banned"),
      reportedBanExpires: sql<string | null>`${reportedUser.banExpires}`.as("reported_ban_expires"),
      reportedInGroup: sql<boolean>`(${memberNetwork.groupJoinedAt} is not null or ${memberNetwork.staleGroupExternalId} is not null)`.as("reported_in_group"),
      resolution: sql<string | null>`${contentReport.resolution}`.as("resolution"),
      resolvedAt: sql<string | null>`${contentReport.resolvedAt}`.as("resolved_at"),
      resolvedByName: sql<string | null>`${contentReport.resolvedByName}`.as("resolved_by_name"),
    })
    .from(contentReport)
    .leftJoin(reporterUser, eq(reporterUser.id, contentReport.reporterId))
    .leftJoin(reportedUser, eq(reportedUser.id, contentReport.reportedMemberId))
    .leftJoin(memberNetwork, eq(memberNetwork.userId, contentReport.reportedMemberId));
}

const MESSAGE_REPORT_FILTERS = {
  [REPORT_FILTERS.open]: isNull(messageReport.resolvedAt),
  [REPORT_FILTERS.resolved]: isNotNull(messageReport.resolvedAt),
};

const CONTENT_REPORT_FILTERS = {
  [REPORT_FILTERS.open]: isNull(contentReport.resolvedAt),
  [REPORT_FILTERS.resolved]: isNotNull(contentReport.resolvedAt),
};

async function countReports(database: Database, filter: ReportFilter) {
  const [[messages], [content]] = await Promise.all([
    database.select({ reportCount: count() }).from(messageReport).where(MESSAGE_REPORT_FILTERS[filter]),
    database.select({ reportCount: count() }).from(contentReport).where(CONTENT_REPORT_FILTERS[filter]),
  ]);
  return (messages?.reportCount ?? 0) + (content?.reportCount ?? 0);
}

export function readOpenReportCount(database: Database) {
  return countReports(database, REPORT_FILTERS.open);
}

type ReportRow = Awaited<ReturnType<ReturnType<typeof selectContentReports>["execute"]>>[number];

async function readExistingFeedTargets(database: Database, rows: ReportRow[]) {
  const idsOfType = (targetType: ReportTarget) =>
    rows.flatMap((row) => (row.targetType === targetType && row.targetId ? [row.targetId] : []));
  const postIds = idsOfType(REPORT_TARGETS.post);
  const commentIds = idsOfType(REPORT_TARGETS.comment);
  const [posts, comments] = await Promise.all([
    postIds.length === 0 ? [] : database.select({ id: post.id }).from(post).where(inArray(post.id, postIds)),
    commentIds.length === 0 ? [] : database.select({ id: comment.id }).from(comment).where(inArray(comment.id, commentIds)),
  ]);
  return new Set([...posts, ...comments].map(({ id }) => id));
}

function toIsoOrNull(timestamp: string | null) {
  return timestamp ? new Date(timestamp).toISOString() : null;
}

function isDeletableTarget(targetType: string): targetType is typeof REPORT_TARGETS.post | typeof REPORT_TARGETS.comment {
  return targetType === REPORT_TARGETS.post || targetType === REPORT_TARGETS.comment;
}

function toReportedMember(row: ReportRow) {
  if (!row.reportedId || !row.reportedName) return null;
  const banExpires = row.reportedBanExpires ? new Date(row.reportedBanExpires) : null;
  return {
    id: row.reportedId,
    name: row.reportedName,
    isAdmin: row.reportedRole === MEMBER_ROLES.admin,
    isRemoved: isBanActive({ banned: row.reportedBanned, banExpires }),
    isInVillageGroup: Boolean(row.reportedInGroup),
  };
}

function toReport(row: ReportRow, existingTargets: ReadonlySet<string>) {
  return {
    id: row.id,
    targetType: row.targetType,
    body: row.body,
    contentCreatedAt: new Date(row.contentCreatedAt).toISOString(),
    createdAt: new Date(row.createdAt).toISOString(),
    reporterName: row.reporterName,
    reportedMemberName: row.reportedName,
    reportedMember: toReportedMember(row),
    isContentGone: isDeletableTarget(row.targetType) && !existingTargets.has(row.targetId ?? ""),
    resolution: row.resolution,
    resolvedAt: toIsoOrNull(row.resolvedAt),
    resolvedByName: row.resolvedByName,
  };
}

export async function readReports(database: Database, filter: ReportFilter, requestedPage: number): Promise<ReportPage> {
  const [open, resolved] = await Promise.all([countReports(database, REPORT_FILTERS.open), countReports(database, REPORT_FILTERS.resolved)]);
  const counts = { [REPORT_FILTERS.open]: open, [REPORT_FILTERS.resolved]: resolved };
  const pageCount = Math.max(1, Math.ceil(counts[filter] / ADMIN_PAGE_SIZES.reports));
  const page = Math.min(requestedPage, pageCount);
  const rows = await unionAll(
    selectMessageReports(database).where(MESSAGE_REPORT_FILTERS[filter]),
    selectContentReports(database).where(CONTENT_REPORT_FILTERS[filter]),
  )
    .orderBy(desc(sql`created_at`), desc(sql`id`))
    .limit(ADMIN_PAGE_SIZES.reports)
    .offset((page - 1) * ADMIN_PAGE_SIZES.reports);
  const existingTargets = await readExistingFeedTargets(database, rows);
  return reportPageSchema.parse({ reports: rows.map((row) => toReport(row, existingTargets)), page, pageCount, counts });
}

function reportHandledError() {
  return new NetworkRequestError(CONFLICT_STATUS, ADMIN_ERROR_CODES.reportHandled, "Another admin already handled this report. Reload the page.");
}

type LockedReport = { targetId: string | null; reportedMemberId: string | null };

async function lockOpenMessageReport(transaction: Transaction, reportId: string): Promise<LockedReport> {
  const [report] = await transaction
    .select({ targetId: messageReport.messageId, reportedMemberId: messageReport.reportedMemberId })
    .from(messageReport)
    .where(and(eq(messageReport.id, reportId), isNull(messageReport.resolvedAt)))
    .for("update");
  if (!report) throw reportHandledError();
  return report;
}

async function lockOpenContentReport(transaction: Transaction, reportId: string, targetType: ReportTarget): Promise<LockedReport> {
  const [report] = await transaction
    .select({ targetId: contentReport.targetId, reportedMemberId: contentReport.reportedMemberId })
    .from(contentReport)
    .where(and(eq(contentReport.id, reportId), eq(contentReport.targetType, targetType), isNull(contentReport.resolvedAt)))
    .for("update");
  if (!report) throw reportHandledError();
  return report;
}

function lockOpenReport(transaction: Transaction, { reportId, targetType }: ReportActionBody) {
  if (targetType === REPORT_TARGETS.directMessage) return lockOpenMessageReport(transaction, reportId);
  return lockOpenContentReport(transaction, reportId, targetType);
}

type Resolution = { report: ReportActionBody; locked: LockedReport; actorId: string; resolution: ReportResolution };

async function resolveSameTarget(transaction: Transaction, { report, locked, actorId, resolution }: Resolution) {
  const resolved = await readResolvedFields(transaction, actorId, resolution);
  if (report.targetType === REPORT_TARGETS.directMessage) {
    await transaction
      .update(messageReport)
      .set(resolved)
      .where(
        and(
          isNull(messageReport.resolvedAt),
          or(eq(messageReport.id, report.reportId), locked.targetId ? eq(messageReport.messageId, locked.targetId) : undefined),
        ),
      );
    return;
  }
  await transaction
    .update(contentReport)
    .set(resolved)
    .where(
      and(
        isNull(contentReport.resolvedAt),
        eq(contentReport.targetType, report.targetType),
        or(eq(contentReport.id, report.reportId), locked.targetId ? eq(contentReport.targetId, locked.targetId) : undefined),
      ),
    );
}

async function readMemberName(transaction: Transaction, memberId: string | null) {
  if (!memberId) return null;
  const [target] = await transaction.select({ name: user.name }).from(user).where(eq(user.id, memberId));
  return target?.name ?? null;
}

export async function dismissReport({ database, member }: NetworkContext, report: ReportActionBody) {
  await withAdminTransaction(database, member.id, async (transaction) => {
    const locked = await lockOpenReport(transaction, report);
    await resolveSameTarget(transaction, { report, locked, actorId: member.id, resolution: REPORT_RESOLUTIONS.dismissed });
    await recordAdminAction(transaction, member.id, {
      action: AUDIT_ACTIONS.reportDismissed,
      targetMemberId: locked.reportedMemberId,
      targetName: await readMemberName(transaction, locked.reportedMemberId),
      detail: report.targetType,
    });
  });
}

const CONTENT_DELETERS = { [REPORT_TARGETS.post]: deletePostWithin, [REPORT_TARGETS.comment]: deleteCommentWithin };

export async function deleteReportedContent({ database, member }: NetworkContext, report: ReportActionBody) {
  const { targetType } = report;
  if (!isDeletableTarget(targetType)) {
    throw new NetworkRequestError(UNPROCESSABLE_STATUS, ADMIN_ERROR_CODES.notDeletable, "Only posts and replies can be deleted from here.");
  }
  await withAdminTransaction(database, member.id, async (transaction) => {
    const locked = await lockOpenReport(transaction, report);
    const targetId = locked.targetId ?? "";
    await CONTENT_DELETERS[targetType](transaction, member, targetId).catch((error: unknown) => {
      if (error instanceof NetworkRequestError && error.status === NOT_FOUND_STATUS) {
        throw new NetworkRequestError(CONFLICT_STATUS, ADMIN_ERROR_CODES.contentGone, "This was already deleted. You can dismiss the report.");
      }
      throw error;
    });
    await resolveSameTarget(transaction, { report, locked, actorId: member.id, resolution: REPORT_RESOLUTIONS.contentDeleted });
    await recordAdminAction(transaction, member.id, {
      action: AUDIT_ACTIONS.reportedContentDeleted,
      targetMemberId: locked.reportedMemberId,
      targetName: await readMemberName(transaction, locked.reportedMemberId),
      detail: targetType,
    });
  });
}
