import { pickOnAccent } from "../design/accent.ts";
import { escapeHtml, toSingleLine } from "./email-text.ts";

export const SIGN_IN_LINK_LIFETIME_SECONDS = 15 * 60;

type SignInLinkEmailFacts = { link: string; communityName: string; accentColor: string };

export function renderSignInLinkEmail({ link, communityName, accentColor }: SignInLinkEmailFacts) {
  const community = toSingleLine(communityName);
  // "Your sign-in link for …", never "Your … sign-in link": the default name is "Your community".
  const subject = `Your sign-in link for ${community}`;
  const opening = `Someone asked to sign in to ${community} with this address. If that was you, open this link and press the button.`;
  const warning = "It works once and lasts 15 minutes. If it wasn't you, ignore this email and nothing changes.";
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px">`,
    `<h1 style="font-size:24px;line-height:30px;margin:0 0 12px">Sign in</h1>`,
    `<p style="margin:0 0 24px">${escapeHtml(opening)}</p>`,
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${accentColor};color:${pickOnAccent(accentColor)};font-weight:700;text-decoration:none">Sign in to ${escapeHtml(community)}</a>`,
    `<p style="margin:24px 0 0;font-size:14px;line-height:20px;color:#566463">${escapeHtml(warning)}</p>`,
    `</div>`,
  ].join("");
  const text = `${opening}\n\nSign in: ${link}\n\n${warning}`;
  return { subject, html, text };
}
