import { pickOnAccent } from "../../platform/design/accent.ts";
import { escapeHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { readResendConfig, sendResendEmail } from "../../platform/email/resend.ts";
import type { Environment } from "../../platform/environment.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { INVITE_EMAIL_STATUSES, INVITE_LIFETIME_DAYS } from "./contract-invite-state.ts";

const IDEMPOTENCY_TOKEN_PREFIX_LENGTH = 16;

type InviteEmailFacts = {
  to: string;
  link: string;
  inviterName: string;
  communityName: string;
  accentColor: string;
};

export function renderInviteEmail({ link, inviterName, communityName, accentColor }: InviteEmailFacts) {
  const inviter = toSingleLine(inviterName);
  const community = toSingleLine(communityName);
  const subject = `${inviter} invited you to ${community}`;
  const opening = `${inviter} saved you a seat in ${community}.`;
  const expiry = `This link works once and expires in ${INVITE_LIFETIME_DAYS} days.`;
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px">`,
    `<h1 style="font-size:24px;line-height:30px;margin:0 0 12px">You're invited</h1>`,
    `<p style="margin:0 0 24px">${escapeHtml(opening)}</p>`,
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${accentColor};color:${pickOnAccent(accentColor)};font-weight:700;text-decoration:none">Accept your invite</a>`,
    `<p style="margin:24px 0 0;font-size:14px;line-height:20px;color:#566463">${escapeHtml(expiry)}</p>`,
    `</div>`,
  ].join("");
  const text = `${opening}\n\nAccept your invite: ${link}\n\n${expiry}`;
  return { subject, html, text };
}

type ConfirmationEmailFacts = { link: string; memberName: string; communityName: string; accentColor: string };

export function renderConfirmationEmail({ link, memberName, communityName, accentColor }: ConfirmationEmailFacts) {
  const community = toSingleLine(communityName);
  const member = toSingleLine(memberName);
  const subject = `Confirm your email for ${community}`;
  const opening = `Someone named ${member} just accepted the ${community} invite sent to this address. If that's you, open this link and confirm while signed in. That turns on network search.`;
  const warning = `If that wasn't you, someone else has your invite, so tell your admin. They can fix it and send you a new one.`;
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px">`,
    `<h1 style="font-size:24px;line-height:30px;margin:0 0 12px">Is this you?</h1>`,
    `<p style="margin:0 0 24px">${escapeHtml(opening)}</p>`,
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${accentColor};color:${pickOnAccent(accentColor)};font-weight:700;text-decoration:none">Confirm my email</a>`,
    `<p style="margin:24px 0 0;font-size:14px;line-height:20px;color:#566463">${escapeHtml(warning)}</p>`,
    `</div>`,
  ].join("");
  const text = `${opening}\n\nConfirm my email: ${link}\n\n${warning}`;
  return { subject, html, text };
}

export async function deliverInviteEmail(facts: InviteEmailFacts, environment: Environment) {
  const config = readResendConfig(environment);
  if (!config) return INVITE_EMAIL_STATUSES.notSent;

  const token = new URL(facts.link).pathname.split("/").at(-1) ?? "";
  const idempotencyKey = `invite-${token.slice(0, IDEMPOTENCY_TOKEN_PREFIX_LENGTH)}`;
  try {
    await sendResendEmail(config, { to: facts.to, idempotencyKey, ...renderInviteEmail(facts) });
    return INVITE_EMAIL_STATUSES.sent;
  } catch (error) {
    logError("invite-email", error);
    return INVITE_EMAIL_STATUSES.failed;
  }
}
