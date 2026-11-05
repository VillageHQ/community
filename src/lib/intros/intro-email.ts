import { and, eq, gt, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { user } from "../../database/auth-schema.ts";
import type { Database } from "../../database/client.ts";
import { introRequest } from "../../database/intro-schema.ts";
import { resolveAppUrl } from "../app-url.ts";
import { readBranding } from "../branding/branding.ts";
import { pickOnAccent } from "../design/accent.ts";
import { readFirstName } from "../design/avatar-identity.ts";
import { escapeHtml, toSingleLine } from "../email/email-text.ts";
import { readResendConfig, sendResendEmail } from "../email/resend.ts";
import type { Environment } from "../environment.ts";
import { logError } from "../route-logging.ts";
import { ROUTES } from "../routes.ts";

export const ASKED_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const INTRO_EMAIL_EVENTS = { asked: "asked", accepted: "accepted", declined: "declined" } as const;

export type IntroEmailEvent = (typeof INTRO_EMAIL_EVENTS)[keyof typeof INTRO_EMAIL_EVENTS];

type IntroEmailNames = { requesterName: string; introducerName: string; targetName: string };
type IntroEmailCopy = { subject: string; heading: string; body: string; action: string };

const INTRO_EMAIL_COPY: Record<IntroEmailEvent, (names: IntroEmailNames) => IntroEmailCopy> = {
  [INTRO_EMAIL_EVENTS.asked]: ({ requesterName, targetName }) => ({
    subject: `${requesterName} asked you for an intro`,
    heading: "Someone asked you for an intro",
    body: `${requesterName} would like an intro to ${targetName}. Read their note and say yes or no. ${readFirstName(targetName)} hears nothing unless you say yes.`,
    action: "Read the ask",
  }),
  [INTRO_EMAIL_EVENTS.accepted]: ({ introducerName, targetName }) => ({
    subject: `${introducerName} said yes to your intro`,
    heading: "Good news",
    body: `${introducerName} said yes to your intro to ${targetName}. They'll reach out to ${readFirstName(targetName)} themselves.`,
    action: "See your ask",
  }),
  [INTRO_EMAIL_EVENTS.declined]: ({ introducerName, targetName }) => ({
    subject: `${introducerName} passed on your intro`,
    heading: "Not this time",
    body: `${introducerName} passed on your intro to ${targetName}. ${readFirstName(targetName)} heard nothing about it. Someone else may be able to help.`,
    action: "See your ask",
  }),
};

const RECIPIENT_BY_EVENT: Record<IntroEmailEvent, keyof IntroEmailParticipants> = {
  [INTRO_EMAIL_EVENTS.asked]: "introducerId",
  [INTRO_EMAIL_EVENTS.accepted]: "requesterId",
  [INTRO_EMAIL_EVENTS.declined]: "requesterId",
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

export async function deliverIntroEmail(database: Database, environment: Environment, facts: IntroEmailFacts) {
  const config = readResendConfig(environment);
  if (!config) return;

  try {
    if (facts.event === INTRO_EMAIL_EVENTS.asked && !(await claimAskedEmail(database, facts))) return;

    const [recipient] = await database
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, facts[RECIPIENT_BY_EVENT[facts.event]]));
    if (!recipient) return;

    const { accentColor } = await readBranding(database);
    const link = `${resolveAppUrl(environment)}${ROUTES.intros}/${facts.introId}`;
    await sendResendEmail(config, {
      to: recipient.email,
      idempotencyKey: `intro-${facts.event}-${facts.introId}`,
      ...renderIntroEmail(facts.event, facts, link, accentColor),
    });
  } catch (error) {
    logError("intro-email", error);
  }
}
