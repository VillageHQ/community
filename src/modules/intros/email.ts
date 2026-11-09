import { and, eq, gt, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { introRequest } from "./schema.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { readBranding } from "../../platform/branding/branding.ts";
import { pickOnAccent } from "../../platform/design/accent.ts";
import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { escapeHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { readResendConfig, sendResendEmail } from "../../platform/email/resend.ts";
import type { Environment } from "../../platform/environment.ts";
import { logError } from "../../platform/observability/route-logging.ts";
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
};

type IntroEmailParticipants = { requesterId: string; introducerId: string };

export type IntroEmailFacts = IntroEmailParticipants & IntroEmailNames & { introId: string; event: IntroEmailEvent };

export function renderIntroEmail(event: IntroEmailEvent, names: IntroEmailNames, link: string, accentColor: string) {
  const { subject, heading, body, action } = INTRO_EMAIL_COPY[event]({
    requesterName: toSingleLine(names.requesterName),
    introducerName: toSingleLine(names.introducerName),
    targetName: toSingleLine(names.targetName),
  });
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px">`,
    `<h1 style="font-size:24px;line-height:30px;margin:0 0 12px">${escapeHtml(heading)}</h1>`,
    `<p style="margin:0 0 24px">${escapeHtml(body)}</p>`,
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${accentColor};color:${pickOnAccent(accentColor)};font-weight:700;text-decoration:none">${escapeHtml(action)}</a>`,
    `</div>`,
  ].join("");
  return { subject, html, text: `${body}\n\n${action}: ${link}` };
}

const recentAsk = alias(introRequest, "recent_ask");

async function claimAskedEmail(database: Database, { introId, requesterId, introducerId }: IntroEmailFacts) {
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

// Resolves true only when Resend took the email. Failures are logged, never thrown.
export async function deliverIntroEmail(database: Database, environment: Environment, facts: IntroEmailFacts) {
  const config = readResendConfig(environment);
  if (!config) return false;

  try {
    if (facts.event === INTRO_EMAIL_EVENTS.asked && !(await claimAskedEmail(database, facts))) return false;

    const [recipient] = await database
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, facts[RECIPIENT_BY_EVENT[facts.event]]));
    if (!recipient) return false;

    const { accentColor } = await readBranding(database);
    const link = `${resolveAppUrl(environment)}${ROUTES.intros}/${facts.introId}`;
    await sendResendEmail(config, {
      to: recipient.email,
      idempotencyKey: `intro-${facts.event}-${facts.introId}`,
      ...renderIntroEmail(facts.event, facts, link, accentColor),
    });
    return true;
  } catch (error) {
    logError("intro-email", error);
    return false;
  }
}
