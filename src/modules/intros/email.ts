import { and, eq, gt, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { introRequest } from "./schema.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { pickOnAccent } from "../../platform/design/accent.ts";
import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { escapeHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { EMAIL_KINDS, type EmailKind } from "../../platform/email/kinds.ts";
import { queueEmail, readEmailBranding, type EmailBranding } from "../../platform/email/outbox.ts";
import { createReplyAddress, REPLY_KINDS, resolveReplySigner } from "../../platform/email/reply-address.ts";
import { sendQueuedEmailNow } from "../../platform/email/outbox-sender.ts";
import type { Environment } from "../../platform/environment.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import { ROUTES } from "../../platform/http/routes.ts";

export const ASKED_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const INTRO_EMAIL_EVENTS = {
  asked: "asked",
  declined: "declined",
  targetAgreed: "target_agreed",
  targetDeclined: "target_declined",
  joinNeeded: "join_needed",
  joined: "joined",
  outcomeAsked: "outcome_asked",
  outcomeReminder: "outcome_reminder",
  connectorReminder: "connector_reminder",
  expired: "expired",
} as const;

export type IntroEmailEvent = (typeof INTRO_EMAIL_EVENTS)[keyof typeof INTRO_EMAIL_EVENTS];

type IntroEmailNames = { requesterName: string; introducerName: string; targetName: string };
type IntroEmailCopy = { subject: string; heading: string; body: string; action: string };

const INTRO_EMAIL_COPY: Record<IntroEmailEvent, (names: IntroEmailNames) => IntroEmailCopy> = {
  [INTRO_EMAIL_EVENTS.asked]: ({ requesterName, targetName }) => ({
    subject: `${requesterName} asked you for an intro`,
    heading: "Someone asked you for an intro",
    body: `${requesterName} would like an intro to ${targetName}. Read their note and say yes or no. ${readFirstName(targetName)} hears nothing unless you say yes.`,
    action: "Read the intro request",
  }),
  [INTRO_EMAIL_EVENTS.declined]: ({ targetName }) => ({
    subject: `Your intro to ${targetName} isn't happening this time`,
    heading: "Not this time",
    body: `Your intro to ${targetName} isn't happening this time. That's normal, and we don't share who answered. Someone else may be able to help.`,
    action: "See other ways in",
  }),
  [INTRO_EMAIL_EVENTS.targetAgreed]: ({ introducerName, targetName }) => ({
    subject: `${readFirstName(targetName)} said yes to your intro`,
    heading: "Good news",
    body: `${targetName} said yes. ${readFirstName(introducerName)} will connect you both with one message.`,
    action: "See your intro request",
  }),
  [INTRO_EMAIL_EVENTS.targetDeclined]: ({ requesterName, targetName }) => ({
    subject: `${readFirstName(targetName)} said no thanks`,
    heading: "No thanks this time",
    body: `${targetName} said no thanks to meeting ${requesterName}. ${readFirstName(requesterName)} sees that this intro isn't happening, not who answered. Nothing more to do.`,
    action: "See the intro request",
  }),
  [INTRO_EMAIL_EVENTS.joinNeeded]: ({ requesterName, targetName }) => ({
    subject: `${readFirstName(targetName)} said yes`,
    heading: "One last step",
    body: `${targetName} said yes to meeting ${requesterName}. Send the message that joins them, then mark it as introduced.`,
    action: "Connect them",
  }),
  [INTRO_EMAIL_EVENTS.joined]: ({ requesterName, targetName }) => ({
    subject: `${readFirstName(targetName)} said yes, and they're connected`,
    heading: "They're connected",
    body: `${targetName} said yes to meeting ${requesterName}, so we emailed them both. Nothing more to do. Thank you.`,
    action: "See the intro request",
  }),
  [INTRO_EMAIL_EVENTS.outcomeAsked]: ({ introducerName, targetName }) => ({
    subject: `Did your intro to ${readFirstName(targetName)} help?`,
    heading: "Did it help?",
    body: `${readFirstName(introducerName)} introduced you to ${targetName} a couple of weeks ago. Did it help? One tap tells ${readFirstName(introducerName)} their intro mattered, and helps this community see which intros work.`,
    action: "Answer in one tap",
  }),
  [INTRO_EMAIL_EVENTS.outcomeReminder]: ({ introducerName, targetName }) => ({
    subject: `A quick one: did meeting ${readFirstName(targetName)} help?`,
    heading: "One tap, then we'll stop asking",
    body: `Did ${readFirstName(introducerName)}'s intro to ${targetName} help? "Not yet" is a fine answer too. This is the last time we'll email about it.`,
    action: "Answer in one tap",
  }),
  [INTRO_EMAIL_EVENTS.connectorReminder]: ({ requesterName, targetName }) => ({
    subject: `Still waiting: ${readFirstName(requesterName)} asked you for an intro`,
    heading: "A quick reminder",
    body: `A few days ago ${requesterName} asked you for an intro to ${targetName}. Yes, not this time, or "I don't know them well enough" are all fine answers, and it takes a few seconds. ${readFirstName(targetName)} hears nothing unless you say yes. This is the only reminder.`,
    action: "Answer the intro request",
  }),
  // Never names who didn't answer: the asker can't tell a quiet connector from a quiet person asked.
  [INTRO_EMAIL_EVENTS.expired]: ({ targetName }) => ({
    subject: `Your intro to ${readFirstName(targetName)} closed without an answer`,
    heading: "No answer this time",
    body: `Your intro request to ${targetName} closed without an answer. That happens, and it says nothing about your ask. Someone else may be able to help, and you can ask again.`,
    action: "See other ways in",
  }),
};

const RECIPIENT_BY_EVENT: Record<IntroEmailEvent, keyof IntroEmailParticipants> = {
  [INTRO_EMAIL_EVENTS.asked]: "introducerId",
  [INTRO_EMAIL_EVENTS.declined]: "requesterId",
  [INTRO_EMAIL_EVENTS.targetAgreed]: "requesterId",
  [INTRO_EMAIL_EVENTS.targetDeclined]: "introducerId",
  [INTRO_EMAIL_EVENTS.joinNeeded]: "introducerId",
  [INTRO_EMAIL_EVENTS.joined]: "introducerId",
  [INTRO_EMAIL_EVENTS.outcomeAsked]: "requesterId",
  [INTRO_EMAIL_EVENTS.outcomeReminder]: "requesterId",
  [INTRO_EMAIL_EVENTS.connectorReminder]: "introducerId",
  [INTRO_EMAIL_EVENTS.expired]: "requesterId",
};

type IntroEmailParticipants = { requesterId: string; introducerId: string };

const KIND_BY_EVENT: Record<IntroEmailEvent, EmailKind> = {
  [INTRO_EMAIL_EVENTS.asked]: EMAIL_KINDS.introAsked,
  [INTRO_EMAIL_EVENTS.declined]: EMAIL_KINDS.introDeclined,
  [INTRO_EMAIL_EVENTS.targetAgreed]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.targetDeclined]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.joinNeeded]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.joined]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.outcomeAsked]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.outcomeReminder]: EMAIL_KINDS.introUpdate,
  [INTRO_EMAIL_EVENTS.connectorReminder]: EMAIL_KINDS.introAsked,
  [INTRO_EMAIL_EVENTS.expired]: EMAIL_KINDS.introDeclined,
};

export type IntroEmailFacts = IntroEmailParticipants & IntroEmailNames & { introId: string; event: IntroEmailEvent };

// The connector answers these by replying YES or NO, when replies are on.
const ANSWERABLE_BY_REPLY: readonly IntroEmailEvent[] = [INTRO_EMAIL_EVENTS.asked, INTRO_EMAIL_EVENTS.connectorReminder];

export const INTRO_REPLY_LINES = {
  on: "Or reply to this email with YES or NO on the first line. To have us email them the note, put their email address after YES.",
  off: "Reply in the app.",
} as const;

export function renderIntroEmail(event: IntroEmailEvent, names: IntroEmailNames, link: string, accentColor: string, canReply = false) {
  const { subject, heading, body, action } = INTRO_EMAIL_COPY[event]({
    requesterName: toSingleLine(names.requesterName),
    introducerName: toSingleLine(names.introducerName),
    targetName: toSingleLine(names.targetName),
  });
  const replyLine = ANSWERABLE_BY_REPLY.includes(event) ? (canReply ? INTRO_REPLY_LINES.on : INTRO_REPLY_LINES.off) : null;
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px">`,
    `<h1 style="font-size:24px;line-height:30px;margin:0 0 12px">${escapeHtml(heading)}</h1>`,
    `<p style="margin:0 0 24px">${escapeHtml(body)}</p>`,
    replyLine ? `<p style="margin:0 0 24px">${escapeHtml(replyLine)}</p>` : "",
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${accentColor};color:${pickOnAccent(accentColor)};font-weight:700;text-decoration:none">${escapeHtml(action)}</a>`,
    `</div>`,
  ].join("");
  return { subject, html, text: [body, replyLine, `${action}: ${link}`].filter(Boolean).join("\n\n") };
}

const recentAsk = alias(introRequest, "recent_ask");

async function claimAskedEmail(database: DatabaseOrTransaction, introId: string, { requesterId, introducerId }: IntroEmailParticipants) {
  const now = new Date();
  const recentlyEmailed = database
    .select({ id: recentAsk.id })
    .from(recentAsk)
    .where(
      and(
        eq(recentAsk.requesterId, requesterId),
        eq(recentAsk.introducerId, introducerId),
        gt(recentAsk.askedEmailAt, new Date(now.getTime() - ASKED_EMAIL_COOLDOWN_MS)),
      ),
    );
  const claimed = await database
    .update(introRequest)
    .set({ askedEmailAt: now })
    .where(and(eq(introRequest.id, introId), notExists(recentlyEmailed)))
    .returning({ id: introRequest.id });
  return claimed.length > 0;
}

// Call inside the transaction that makes the move. The cooldown stamp and the queued email are
// saved together, so an ask is never marked emailed without an email on its way. One email per
// intro and event: a repeat finds the row already queued.
export async function queueIntroEmail(
  transaction: DatabaseOrTransaction,
  environment: Environment,
  branding: EmailBranding | null,
  introId: string,
  event: IntroEmailEvent,
) {
  if (!branding) return null;

  const [intro] = await transaction
    .select({
      requesterId: introRequest.requesterId,
      introducerId: introRequest.introducerId,
      introducerName: introRequest.introducerName,
      targetName: introRequest.targetName,
      requesterName: user.name,
    })
    .from(introRequest)
    .innerJoin(user, eq(user.id, introRequest.requesterId))
    .where(eq(introRequest.id, introId));
  if (!intro) return null;
  if (event === INTRO_EMAIL_EVENTS.asked && !(await claimAskedEmail(transaction, introId, intro))) return null;

  const recipientId = intro[RECIPIENT_BY_EVENT[event]];
  const [recipient] = await transaction.select({ email: user.email }).from(user).where(eq(user.id, recipientId));
  if (!recipient) return null;

  const link = `${resolveAppUrl(environment)}${ROUTES.intros}/${introId}`;
  const names = { requesterName: removeBidiControls(intro.requesterName), introducerName: intro.introducerName, targetName: intro.targetName };
  const signer = ANSWERABLE_BY_REPLY.includes(event) ? await resolveReplySigner(transaction, environment) : null;
  const replyTo = signer ? createReplyAddress(signer, REPLY_KINDS.introAsk, introId, { memberId: recipientId }) : null;
  return queueEmail(transaction, environment, {
    kind: KIND_BY_EVENT[event],
    to: recipient.email,
    memberId: recipientId,
    dedupeKey: `intro-${event}-${introId}`,
    replyTo,
    ...renderIntroEmail(event, names, link, branding.accentColor, replyTo !== null),
  });
}

// For moves that happen outside a member's request (a target's answer, the outcome emails).
// Resolves true once the email has gone out. A failed try stays queued, and the timed sender
// keeps trying it. Failures are logged, never thrown.
export async function deliverIntroEmail(database: Database, environment: Environment, facts: IntroEmailFacts) {
  try {
    const branding = await readEmailBranding(database, environment);
    if (!branding) return false;
    const queuedId = await database.transaction((transaction) => queueIntroEmail(transaction, environment, branding, facts.introId, facts.event));
    return await sendQueuedEmailNow(database, environment, queuedId);
  } catch (error) {
    logError("intro-email", error);
    return false;
  }
}
