import { pickOnAccent } from "../../platform/design/accent.ts";
import { escapeHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { readInviteWords } from "./contract-invite-email.ts";

const LINE_BREAK = "\n";

type InviteEmailFacts = {
  link: string;
  inviterName: string;
  // The inviter's role on their card ("Head of Platform"); it signs the email.
  inviterRole?: string | null;
  // From a bulk list: "Hi Ada,".
  inviteeName?: string | null;
  communityName: string;
  accentColor: string;
};

// Founderhall's invite, word for word. Plain text first; the HTML is the same words, with the link as a button.
export function renderInviteEmail({ link, inviterName, inviterRole, inviteeName, communityName, accentColor }: InviteEmailFacts) {
  const community = toSingleLine(communityName);
  const words = readInviteWords({
    community,
    inviteeName: inviteeName ? toSingleLine(inviteeName) : null,
    inviterName: toSingleLine(inviterName),
    inviterRole: inviterRole ? toSingleLine(inviterRole) : null,
    apostrophe: "'",
  });
  const text = [words.hi, "", words.lead, "", `${words.how}:`, link, "", words.small, "", words.sign, "", words.ignore, "", words.footer].join(LINE_BREAK);
  const paragraph = (line: string, style = "margin:0 0 16px") => `<p style="${style}">${escapeHtml(line)}</p>`;
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:22px;color:#1B2420;max-width:560px;margin:0 auto;padding:24px">`,
    paragraph(words.hi),
    paragraph(words.lead),
    paragraph(`${words.how}:`, "margin:0 0 8px"),
    `<p style="margin:0 0 16px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:8px 14px;border-radius:6px;background:${accentColor};color:${pickOnAccent(accentColor)};font-weight:600;text-decoration:none">${escapeHtml(words.button)}</a></p>`,
    paragraph(words.small, "margin:0 0 16px;font-size:13px;color:#59625D"),
    paragraph(words.sign),
    paragraph(words.ignore, "margin:0 0 16px;font-size:13px;color:#59625D"),
    paragraph(words.footer, "margin:0;font-size:12px;color:#59625D"),
    `</div>`,
  ].join("");
  return { subject: toSingleLine(words.subject), html, text };
}

type InviteUsedEmailFacts = { link: string; communityName: string; accentColor: string };

// After a join from the emailed invite: the address hears about it, in case someone else had the email.
export function renderInviteUsedEmail({ link, communityName, accentColor }: InviteUsedEmailFacts) {
  const community = toSingleLine(communityName);
  const subject = `Your ${community} invite was used`;
  const opening = `Someone just joined ${community} with the invite sent to this address. If that was you, welcome: there's nothing to do.`;
  const warning = `If it wasn't you, someone else has your invite email. Open this link: we'll sign them out, and your admins will send you a new invite.`;
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:22px;color:#1B2420;max-width:560px;margin:0 auto;padding:24px">`,
    `<p style="margin:0 0 16px">${escapeHtml(opening)}</p>`,
    `<p style="margin:0 0 16px">${escapeHtml(warning)}</p>`,
    `<p style="margin:0 0 16px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:8px 14px;border-radius:6px;background:${accentColor};color:${pickOnAccent(accentColor)};font-weight:600;text-decoration:none">It wasn't me</a></p>`,
    `</div>`,
  ].join("");
  const text = `${opening}

${warning}

It wasn't me: ${link}`;
  return { subject, html, text };
}

type ConfirmationEmailFacts = { link: string; memberName: string; communityName: string; accentColor: string };

export function renderConfirmationEmail({ link, memberName, communityName, accentColor }: ConfirmationEmailFacts) {
  const community = toSingleLine(communityName);
  const member = toSingleLine(memberName);
  const subject = `Confirm your email for ${community}`;
  const opening = `Someone named ${member} just accepted the ${community} invite sent to this address. If that's you, open this link and confirm while signed in.`;
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
