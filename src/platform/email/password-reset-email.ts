import { pickOnAccent } from "../design/accent.ts";
import { escapeHtml, toSingleLine } from "./email-text.ts";

export const PASSWORD_RESET_LIFETIME_SECONDS = 3_600;

type PasswordResetEmailFacts = { link: string; communityName: string; accentColor: string };

export function renderPasswordResetEmail({ link, communityName, accentColor }: PasswordResetEmailFacts) {
  const community = toSingleLine(communityName);
  const subject = `Reset your ${community} password`;
  const opening = `Someone asked to reset the password for this address on ${community}. If that was you, choose a new one with this link.`;
  const warning = "It works once and lasts one hour. If it wasn't you, ignore this email and nothing changes.";
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px">`,
    `<h1 style="font-size:24px;line-height:30px;margin:0 0 12px">Reset your password</h1>`,
    `<p style="margin:0 0 24px">${escapeHtml(opening)}</p>`,
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${accentColor};color:${pickOnAccent(accentColor)};font-weight:700;text-decoration:none">Choose a new password</a>`,
    `<p style="margin:24px 0 0;font-size:14px;line-height:20px;color:#566463">${escapeHtml(warning)}</p>`,
    `</div>`,
  ].join("");
  const text = `${opening}\n\nChoose a new password: ${link}\n\n${warning}`;
  return { subject, html, text };
}
