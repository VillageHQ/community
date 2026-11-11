import { escapeHtml, toSingleLine } from "../../platform/email/email-text.ts";

type DeletionRequestFacts = { memberName: string; memberEmail: string; communityName: string; membersLink: string };

// Founderhall's "<name> asked to delete their account" (copy/emails/email-delete-request-to-admin.md), word for word.
// Plain words; the HTML part carries the same paragraphs.
export function renderDeletionRequestEmail({ memberName, memberEmail, communityName, membersLink }: DeletionRequestFacts) {
  const name = toSingleLine(memberName);
  const community = toSingleLine(communityName);
  const subject = `${name} asked to delete their account`;
  const paragraphs = [
    "Hi,",
    `${name} (${toSingleLine(memberEmail)}) asked ${community} to delete their account, from the Your data page.`,
    `See them in Members: ${membersLink}`,
    `Sent by ${community} via its member portal.`,
  ];
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:22px;color:#1b2420;max-width:560px;padding:16px">`,
    ...paragraphs.map((paragraph) => `<p style="margin:0 0 14px">${escapeHtml(paragraph)}</p>`),
    `</div>`,
  ].join("");
  return { subject, html, text: paragraphs.join("\n\n") };
}
