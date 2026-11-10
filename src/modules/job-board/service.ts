import "server-only";

import { and, count, eq, sql } from "drizzle-orm";
import type { z } from "zod";

import { isAdminMember } from "@/platform/auth/roles";
import { user } from "@/platform/database/auth-schema";
import type { Database, DatabaseOrTransaction, Transaction } from "@/platform/database/client";
import type { RequestContext } from "@/platform/http/request-context";
import { RequestError } from "@/platform/http/request-error";
import { logAdminAction } from "@/platform/observability/route-logging";
import { saveSettings } from "@/platform/settings/store";

import {
  FEED_TOOLS,
  JOB_BOARD_ERROR_CODES,
  JOB_BOARD_LIMITS,
  MANUAL_TOOL,
  PUBLIC_BOARD_SETTING,
  toCompanySlug,
  type addJobBodySchema,
  type hideSourceBodySchema,
  type linkSourceBodySchema,
  type manualSourceBodySchema,
  type removeJobBodySchema,
} from "./contract";
import { detectBoard, describeLinkProblem } from "./rules-feeds";
import { jobPosting, jobSource } from "./schema";
import { pullSource, type PullOutcome } from "./service-pull";
import { readMemberCompany } from "./reads";

const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const TOO_MANY_STATUS = 429;

type SourceRow = typeof jobSource.$inferSelect;

function sourceNotFound() {
  return new RequestError(NOT_FOUND_STATUS, JOB_BOARD_ERROR_CODES.sourceNotFound, "That source isn't there anymore.");
}

async function readSource(database: Database, sourceId: string) {
  const [source] = await database.select().from(jobSource).where(eq(jobSource.id, sourceId));
  return source ?? null;
}

// The member who linked a source changes it. An admin may pull and hide any source.
async function readOwnSource({ database, member }: RequestContext, sourceId: string, { adminToo }: { adminToo: boolean }) {
  const source = await readSource(database, sourceId);
  if (!source) throw sourceNotFound();
  const isOwner = source.memberId === member.id;
  if (!isOwner && !(adminToo && isAdminMember(member))) throw sourceNotFound();
  return { source, isOwner };
}

async function lockMember(transaction: Transaction, memberId: string) {
  await transaction.select({ id: user.id }).from(user).where(eq(user.id, memberId)).for("no key update");
}

async function assertSourceAllowance(database: DatabaseOrTransaction, memberId: string) {
  const [row] = await database.select({ total: count() }).from(jobSource).where(eq(jobSource.memberId, memberId));
  if ((row?.total ?? 0) >= JOB_BOARD_LIMITS.sourcesPerMember) {
    throw new RequestError(CONFLICT_STATUS, JOB_BOARD_ERROR_CODES.sourceLimit, `You can link up to ${JOB_BOARD_LIMITS.sourcesPerMember} sources. Remove one first.`);
  }
}

// A founder shares jobs only for the company on their own card. An admin may add any company.
async function assertOwnCompany({ database, member }: RequestContext, company: string) {
  if (isAdminMember(member)) return;
  const ownCompany = (await readMemberCompany(database, member.id)).trim();
  if (!ownCompany) {
    throw new RequestError(FORBIDDEN_STATUS, JOB_BOARD_ERROR_CODES.companyMissing, "Add your company to your card first. Then you can share its jobs here.");
  }
  if (toCompanySlug(company) !== toCompanySlug(ownCompany)) {
    throw new RequestError(
      FORBIDDEN_STATUS,
      JOB_BOARD_ERROR_CODES.companyNotYours,
      `You can share jobs only for your own company, ${ownCompany}. If that's changed, update your card first. An admin can add other companies.`,
    );
  }
}

// One source per careers link in the whole community, so no job shows twice. The lock keeps two
// quick clicks, or two founders at once, from both passing the check.
// Board names are compared without case: the tools treat "Stripe" and "stripe" as one board.
async function assertBoardFree(transaction: Transaction, tool: string, slug: string) {
  const boardName = slug.toLowerCase();
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`job_source:${tool}:${boardName}`}))`);
  const [taken] = await transaction
    .select({ company: jobSource.company })
    .from(jobSource)
    .where(and(eq(jobSource.tool, tool), sql`lower(${jobSource.slug}) = ${boardName}`))
    .limit(1);
  if (taken) throw new RequestError(CONFLICT_STATUS, JOB_BOARD_ERROR_CODES.linkTaken, `This careers link is already on the board, for ${taken.company}.`);
}

function describePull(outcome: PullOutcome) {
  if (!outcome.ok) return outcome.error;
  if (outcome.count === 0) return "Linked. The board has no open jobs right now. We check again every hour.";
  return `Linked. We found ${outcome.count} open ${outcome.count === 1 ? "job" : "jobs"}, and check again every hour.`;
}

export async function linkSource(context: RequestContext, body: z.infer<typeof linkSourceBodySchema>) {
  const board = detectBoard(body.link);
  if (!board) throw new RequestError(UNPROCESSABLE_STATUS, JOB_BOARD_ERROR_CODES.notALink, describeLinkProblem(body.link));
  await assertOwnCompany(context, body.company);
  const source = await context.database.transaction(async (transaction) => {
    // The member row lock keeps two quick clicks from passing the limit together. It leaves foreign keys free.
    await lockMember(transaction, context.member.id);
    await assertSourceAllowance(transaction, context.member.id);
    await assertBoardFree(transaction, board.tool, board.slug);
    const [created] = await transaction
      .insert(jobSource)
      .values({ memberId: context.member.id, company: body.company, companySlug: toCompanySlug(body.company), tool: board.tool, slug: board.slug, sourceUrl: board.link })
      .returning();
    return created;
  });
  if (!source) throw sourceNotFound();
  const outcome = await pullSource(context.database, context.environment, source);
  return { id: source.id, ok: outcome.ok, message: outcome.ok ? describePull(outcome) : `Linked ${FEED_TOOLS[board.tool].label}, but: ${outcome.error}` };
}

export async function createManualSource(context: RequestContext, body: z.infer<typeof manualSourceBodySchema>) {
  await assertOwnCompany(context, body.company);
  const source = await context.database.transaction(async (transaction) => {
    await lockMember(transaction, context.member.id);
    await assertSourceAllowance(transaction, context.member.id);
    const [created] = await transaction
      .insert(jobSource)
      .values({ memberId: context.member.id, company: body.company, companySlug: toCompanySlug(body.company), tool: MANUAL_TOOL, slug: null })
      .returning({ id: jobSource.id });
    return created;
  });
  if (!source) throw sourceNotFound();
  return { id: source.id, message: `Added ${body.company}. Now add its jobs.` };
}

function assertPullAllowed(source: SourceRow) {
  if (!source.slug) throw new RequestError(UNPROCESSABLE_STATUS, JOB_BOARD_ERROR_CODES.notManual, "These jobs were added by hand, so there's nothing to pull.");
  const waitedMs = source.lastPulledAt ? Date.now() - source.lastPulledAt.getTime() : Number.POSITIVE_INFINITY;
  if (waitedMs < JOB_BOARD_LIMITS.pullNowEverySeconds * 1000) {
    throw new RequestError(TOO_MANY_STATUS, JOB_BOARD_ERROR_CODES.tooSoon, "This board was pulled less than a minute ago. Try again in a minute.");
  }
}

export async function pullSourceNow(context: RequestContext, sourceId: string) {
  const { source, isOwner } = await readOwnSource(context, sourceId, { adminToo: true });
  assertPullAllowed(source);
  if (!isOwner) logAdminAction("job_source_pulled", context.member.id, source.id);
  const outcome = await pullSource(context.database, context.environment, source);
  return { ok: outcome.ok, message: outcome.ok ? `Pulled. ${outcome.count} open ${outcome.count === 1 ? "job" : "jobs"}.` : outcome.error };
}

export async function setSourceHidden(context: RequestContext, body: z.infer<typeof hideSourceBodySchema>) {
  const { source, isOwner } = await readOwnSource(context, body.sourceId, { adminToo: true });
  const isAdmin = isAdminMember(context.member);
  // An admin's Hide sticks: the founder can't show the jobs again, only an admin can.
  if (!body.hidden && source.hiddenByAdmin && !isAdmin) {
    throw new RequestError(FORBIDDEN_STATUS, JOB_BOARD_ERROR_CODES.hiddenByAdmin, "An admin hid these jobs, so only an admin can show them again.");
  }
  const hiddenByAdmin = body.hidden && (source.hiddenByAdmin || (isAdmin && !isOwner));
  await context.database.update(jobSource).set({ hidden: body.hidden, hiddenByAdmin }).where(eq(jobSource.id, source.id));
  if (!isOwner) logAdminAction(body.hidden ? "job_source_hidden" : "job_source_shown", context.member.id, source.id);
  return { message: body.hidden ? `${source.company}'s jobs are hidden from every board.` : `${source.company}'s jobs are back on the board.` };
}

export async function removeSource(context: RequestContext, sourceId: string) {
  const { source } = await readOwnSource(context, sourceId, { adminToo: false });
  await context.database.delete(jobSource).where(eq(jobSource.id, source.id));
  return { message: `Removed ${source.company} and its jobs.` };
}

export async function addManualJob(context: RequestContext, body: z.infer<typeof addJobBodySchema>) {
  const { source } = await readOwnSource(context, body.sourceId, { adminToo: false });
  await context.database.transaction(async (transaction) => {
    await transaction.select({ id: jobSource.id }).from(jobSource).where(eq(jobSource.id, source.id)).for("no key update");
    const [row] = await transaction
      .select({ total: count() })
      .from(jobPosting)
      .where(and(eq(jobPosting.sourceId, source.id), eq(jobPosting.isManual, true)));
    if ((row?.total ?? 0) >= JOB_BOARD_LIMITS.manualJobsPerSource) {
      throw new RequestError(CONFLICT_STATUS, JOB_BOARD_ERROR_CODES.manualLimit, `You can add up to ${JOB_BOARD_LIMITS.manualJobsPerSource} jobs by hand here. Remove one first.`);
    }
    await transaction.insert(jobPosting).values({
      sourceId: source.id,
      externalId: `manual-${crypto.randomUUID()}`,
      title: body.title,
      location: body.location,
      url: body.url,
      postedAt: new Date(),
      isManual: true,
    });
  });
  return { message: `Added "${body.title}".` };
}

export async function removeManualJob(context: RequestContext, body: z.infer<typeof removeJobBodySchema>) {
  const { source } = await readOwnSource(context, body.sourceId, { adminToo: false });
  const removed = await context.database
    .delete(jobPosting)
    .where(and(eq(jobPosting.id, body.jobId), eq(jobPosting.sourceId, source.id), eq(jobPosting.isManual, true)))
    .returning({ id: jobPosting.id });
  if (removed.length === 0) throw new RequestError(NOT_FOUND_STATUS, JOB_BOARD_ERROR_CODES.jobNotFound, "That job isn't there anymore.");
  return { message: "Removed the job." };
}

export async function setPublicBoard(context: RequestContext, isPublic: boolean) {
  await saveSettings(context.database, { [PUBLIC_BOARD_SETTING]: isPublic ? "on" : "off" });
  logAdminAction(isPublic ? "job_board_public_on" : "job_board_public_off", context.member.id, PUBLIC_BOARD_SETTING);
  return { message: isPublic ? "The public board and the website widget are on." : "The public board and the website widget are off. Visitors see a not-found page." };
}
