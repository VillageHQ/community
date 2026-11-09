import { eq } from "drizzle-orm";

import { readBranding } from "../../platform/branding/branding.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { pickOnAccent } from "../../platform/design/accent.ts";
import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { escapeHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { readResendConfig, sendResendEmail } from "../../platform/email/resend.ts";
import type { Environment } from "../../platform/environment.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { ROUTES } from "../../platform/http/routes.ts";
import type { Intro } from "./contract.ts";
import { readWhyTheyWrote } from "./copy.ts";
import type { introRequest } from "./schema.ts";

const IDEMPOTENCY_TOKEN_PREFIX_LENGTH = 16;
const EMAIL_FRAME = "font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px";

type ConsentAskFacts = { requesterName: string; introducerName: string; targetName: string; communityName: string };

export function renderConsentAskEmail(facts: ConsentAskFacts, link: string, accentColor: string) {
  const requesterName = toSingleLine(facts.requesterName);
  const introducerName = toSingleLine(facts.introducerName);
  const targetFirst = toSingleLine(readFirstName(facts.targetName));
  const communityName = toSingleLine(facts.communityName);
  const requesterFirst = readFirstName(requesterName);
  const subject = `${readFirstName(introducerName)} asked if you'd like to meet ${requesterFirst}`;
  const greeting = `Hi ${targetFirst},`;
  const body = `${requesterName} asked ${introducerName} for an intro to you through ${communityName}. Read their note and say yes or no thanks. It takes a few seconds, and you don't need an account. Nothing happens unless you say yes.`;
  const action = "Read the note";
  const html = [
    `<div style="${EMAIL_FRAME}">`,
    `<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>`,
    `<p style="margin:0 0 24px">${escapeHtml(body)}</p>`,
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${accentColor};color:${pickOnAccent(accentColor)};font-weight:700;text-decoration:none">${escapeHtml(action)}</a>`,
    `</div>`,
  ].join("");
  return { subject, html, text: `${greeting}\n\n${body}\n\n${action}: ${link}` };
}

type ConsentAskRequest = { intro: Intro; token: string; targetEmail: string };

export async function sendConsentAskEmail(database: Database, environment: Environment, { intro, token, targetEmail }: ConsentAskRequest) {
  const config = readResendConfig(environment);
  if (!config) throw new Error("Email isn't configured.");
  const { name: communityName, accentColor } = await readBranding(database);
  const link = `${resolveAppUrl(environment)}${ROUTES.introConsent}/${token}`;
  const facts = { requesterName: intro.requester.name, introducerName: intro.introducer.name, targetName: intro.target.name, communityName };
  await sendResendEmail(config, {
    to: targetEmail,
    idempotencyKey: `intro-consent-${token.slice(0, IDEMPOTENCY_TOKEN_PREFIX_LENGTH)}`,
    ...renderConsentAskEmail(facts, link, accentColor),
  });
}

type JoiningFacts = { requesterName: string; introducerName: string; targetName: string; communityName: string; note: string };

export function renderJoiningEmail({ requesterName, introducerName, targetName, communityName, note }: JoiningFacts) {
  const targetFirst = toSingleLine(readFirstName(targetName));
  const requesterFirst = toSingleLine(readFirstName(requesterName));
  const subject = `${targetFirst}, meet ${requesterFirst}`;
  const opening = `${targetFirst}, meet ${requesterFirst}. ${requesterFirst}, meet ${targetFirst}.`;
  const context = `${toSingleLine(introducerName)} connected you through ${toSingleLine(communityName)}, and ${targetFirst} said yes. Here's what ${requesterFirst} wrote:`;
  const closing = "You're both on this email, so reply all to say hello. This is the only email we'll send about this intro.";
  const html = [
    `<div style="${EMAIL_FRAME}">`,
    `<p style="margin:0 0 12px;font-weight:700">${escapeHtml(opening)}</p>`,
    `<p style="margin:0 0 12px">${escapeHtml(context)}</p>`,
    `<p style="margin:0 0 24px;white-space:pre-wrap">${escapeHtml(note)}</p>`,
    `<p style="margin:0">${escapeHtml(closing)}</p>`,
    `</div>`,
  ].join("");
  return { subject, html, text: `${opening}\n\n${context}\n\n${note}\n\n${closing}` };
}

export async function sendJoiningEmail(database: Database, environment: Environment, intro: typeof introRequest.$inferSelect, requesterName: string) {
  const config = readResendConfig(environment);
  if (!config || !intro.targetEmail) throw new Error("Email isn't configured.");
  const [requester] = await database.select({ email: user.email }).from(user).where(eq(user.id, intro.requesterId));
  if (!requester) throw new Error("The requester is gone.");
  const { name: communityName } = await readBranding(database);
  await sendResendEmail(config, {
    to: [intro.targetEmail, requester.email],
    // Not "intro-joined-…": that key belongs to the connector's notice for the same event, and Resend refuses a reused key.
    idempotencyKey: `intro-joining-${intro.id}`,
    ...renderJoiningEmail({
      requesterName,
      introducerName: intro.introducerName,
      targetName: intro.targetName,
      communityName,
      note: readWhyTheyWrote(intro.note, intro.introducerName, intro.targetName),
    }),
  });
}
