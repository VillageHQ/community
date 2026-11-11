import "server-only";

import { and, asc, count, eq, gt, or } from "drizzle-orm";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { escapeHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { EMAIL_KINDS } from "../../platform/email/kinds.ts";
import { queueEmail } from "../../platform/email/outbox.ts";
import { sendQueuedEmailsSoon } from "../../platform/email/outbox-sender.ts";
import { createReplyAddress, REPLY_KINDS, type ReplySigner } from "../../platform/email/reply-address.ts";
import type { Environment } from "../../platform/environment.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { ROUTES } from "../../platform/http/routes.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import { INTRO_LIMITS, INTRO_STATES } from "./contract.ts";
import { introductionSubject } from "./email-copy.ts";
import { INTRO_THREAD_AUTHORS, introRequest, introThread, introThreadMessage, type IntroThreadAuthor } from "./schema.ts";

const DAY_MS = 24 * 60 * 60_000;
const GONE_STATUS = 410;
const TOO_MANY_REQUESTS_STATUS = 429;
// Each side may pass on this many replies a day, so the outside person can't be flooded through us.
const MAXIMUM_REPLIES_PER_DAY = 20;
const EMAIL_FRAME = "font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px";

export const INTRO_THREAD_ERROR_CODES = { closed: "intro_thread_closed", tooMany: "intro_thread_too_many" } as const;

export function introThreadSubject(requesterName: string, targetName: string, introducerName: string) {
  return introductionSubject(requesterName, targetName, introducerName);
}

// The addresses of one intro thread: the asker's and the connector's (members) and the outside person's (their email).
export function introThreadReplyTo(signer: ReplySigner, introId: string, person: { memberId: string } | { email: string }) {
  return createReplyAddress(signer, REPLY_KINDS.introThread, introId, person);
}

// Saved when the joint introduction goes out with replies on. A second call keeps the first address.
export async function openIntroThread(connection: DatabaseOrTransaction, introId: string, targetEmail: string) {
  await connection.insert(introThread).values({ introId, targetEmail: targetEmail.trim().toLowerCase() }).onConflictDoNothing();
}

// The thread as the reply router needs it: who is in it, and whether it still takes replies.
export async function readIntroThreadParties(connection: DatabaseOrTransaction, introId: string, now = new Date()) {
  const [row] = await connection
    .select({
      introId: introThread.introId,
      targetEmail: introThread.targetEmail,
      createdAt: introThread.createdAt,
      requesterId: introRequest.requesterId,
      requesterEmail: user.email,
      requesterName: user.name,
      targetName: introRequest.targetName,
      introducerId: introRequest.introducerId,
      introducerName: introRequest.introducerName,
      state: introRequest.state,
    })
    .from(introThread)
    .innerJoin(introRequest, eq(introRequest.id, introThread.introId))
    .innerJoin(user, and(eq(user.id, introRequest.requesterId), isActiveMember(now)))
    .where(eq(introThread.introId, introId));
  if (!row) return null;
  const isOpen = row.state === INTRO_STATES.completed && now.getTime() - row.createdAt.getTime() <= INTRO_LIMITS.threadDays * DAY_MS;
  return { ...row, isOpen };
}

type ThreadParties = NonNullable<Awaited<ReturnType<typeof readIntroThreadParties>>>;

function renderRelayEmail({ authorName, body, subject, closing, link }: { authorName: string; body: string; subject: string; closing: string; link: string | null }) {
  const author = toSingleLine(removeBidiControls(authorName));
  const opening = `${author} wrote:`;
  const html = [
    `<div style="${EMAIL_FRAME}">`,
    `<p style="margin:0 0 12px;font-weight:700">${escapeHtml(opening)}</p>`,
    `<p style="margin:0 0 24px;white-space:pre-wrap">${escapeHtml(body)}</p>`,
    `<p style="margin:0">${escapeHtml(closing)}</p>`,
    link ? `<p style="margin:12px 0 0"><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>` : "",
    `</div>`,
  ].join("");
  const text = [opening, body, closing, link].filter(Boolean).join("\n\n");
  return { subject: `Re: ${subject}`, html, text };
}

async function readMemberEmail(connection: DatabaseOrTransaction, memberId: string, now: Date) {
  const [member] = await connection.select({ email: user.email }).from(user).where(and(eq(user.id, memberId), isActiveMember(now)));
  return member?.email ?? null;
}

const AUTHOR_NAMES: Record<IntroThreadAuthor, (parties: ThreadParties) => string> = {
  [INTRO_THREAD_AUTHORS.requester]: (parties) => removeBidiControls(parties.requesterName),
  [INTRO_THREAD_AUTHORS.target]: (parties) => parties.targetName,
  [INTRO_THREAD_AUTHORS.introducer]: (parties) => parties.introducerName,
};

// One reply goes to the two others in the thread: the asker, the person asked and the connector (copied).
async function queueRelay(connection: DatabaseOrTransaction, environment: Environment, signer: ReplySigner, parties: ThreadParties, author: IntroThreadAuthor, body: string) {
  const subject = introThreadSubject(parties.requesterName, parties.targetName, parties.introducerName);
  const authorName = AUTHOR_NAMES[author](parties);
  const authorFirst = readFirstName(authorName);
  const link = `${resolveAppUrl(environment)}${ROUTES.intros}/${parties.introId}`;
  if (author !== INTRO_THREAD_AUTHORS.target) {
    await queueEmail(connection, environment, {
      kind: EMAIL_KINDS.introThread,
      to: parties.targetEmail,
      memberId: null,
      replyTo: introThreadReplyTo(signer, parties.introId, { email: parties.targetEmail }),
      ...renderRelayEmail({ authorName, body, subject, closing: `Reply to this email to answer ${authorFirst}.`, link: null }),
    });
  }
  if (author !== INTRO_THREAD_AUTHORS.requester) {
    await queueEmail(connection, environment, {
      kind: EMAIL_KINDS.introThread,
      to: parties.requesterEmail,
      memberId: parties.requesterId,
      replyTo: introThreadReplyTo(signer, parties.introId, { memberId: parties.requesterId }),
      ...renderRelayEmail({ authorName, body, subject, closing: `Reply to this email to answer ${authorFirst}. The conversation is also on your intro's page.`, link }),
    });
  }
  const introducerEmail = author === INTRO_THREAD_AUTHORS.introducer ? null : await readMemberEmail(connection, parties.introducerId, new Date());
  if (introducerEmail) {
    await queueEmail(connection, environment, {
      kind: EMAIL_KINDS.introThread,
      to: introducerEmail,
      memberId: parties.introducerId,
      replyTo: introThreadReplyTo(signer, parties.introId, { memberId: parties.introducerId }),
      ...renderRelayEmail({ authorName, body, subject, closing: `Reply to this email to answer ${authorFirst}.`, link: null }),
    });
  }
}

type ThreadReply = { introId: string; author: IntroThreadAuthor; body: string; sourceEmailId: string | null };

// Saves one reply and queues it to the other person in the same transaction. A webhook sent again finds the
// saved reply and does nothing.
export async function postIntroThreadReply(database: Database, environment: Environment, signer: ReplySigner, { introId, author, body, sourceEmailId }: ThreadReply) {
  const now = new Date();
  const queued = await database.transaction(async (transaction) => {
    const [locked] = await transaction.select({ introId: introThread.introId }).from(introThread).where(eq(introThread.introId, introId)).for("update");
    const parties = locked ? await readIntroThreadParties(transaction, introId, now) : null;
    if (!parties?.isOpen) throw new RequestError(GONE_STATUS, INTRO_THREAD_ERROR_CODES.closed, "This introduction no longer takes replies by email.");
    const [today] = await transaction
      .select({ total: count() })
      .from(introThreadMessage)
      .where(and(eq(introThreadMessage.introId, introId), eq(introThreadMessage.author, author), gt(introThreadMessage.createdAt, new Date(now.getTime() - DAY_MS))));
    if ((today?.total ?? 0) >= MAXIMUM_REPLIES_PER_DAY) {
      throw new RequestError(TOO_MANY_REQUESTS_STATUS, INTRO_THREAD_ERROR_CODES.tooMany, "You've sent a lot of replies in this introduction today. Try again tomorrow.");
    }
    const [saved] = await transaction.insert(introThreadMessage).values({ introId, author, body, sourceEmailId }).onConflictDoNothing().returning({ id: introThreadMessage.id });
    if (!saved) return { id: null, isRepeat: true };
    await queueRelay(transaction, environment, signer, parties, author, body);
    return { id: saved.id, isRepeat: false };
  });
  if (!queued.isRepeat) sendQueuedEmailsSoon(database, environment);
  return queued;
}

export type IntroThreadEntry = { id: string; author: IntroThreadAuthor; body: string; createdAt: string };

// The thread on the intro's page, for the asker and the connector (copied on it). Admins never see it.
export async function readIntroThreadForRequester(database: Database, introId: string, memberId: string) {
  const [thread] = await database
    .select({ introId: introThread.introId })
    .from(introThread)
    .innerJoin(introRequest, eq(introRequest.id, introThread.introId))
    .where(and(eq(introThread.introId, introId), or(eq(introRequest.requesterId, memberId), eq(introRequest.introducerId, memberId))));
  if (!thread) return null;
  const rows = await database
    .select({ id: introThreadMessage.id, author: introThreadMessage.author, body: introThreadMessage.body, createdAt: introThreadMessage.createdAt })
    .from(introThreadMessage)
    .where(eq(introThreadMessage.introId, introId))
    .orderBy(asc(introThreadMessage.createdAt));
  return rows.map((row): IntroThreadEntry => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
