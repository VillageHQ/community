import { escapeHtml } from "./email-text.ts";

const LINK_PATTERN = /https?:\/\/[^\s<>"']+/g;

// Founderhall sends plain text only. The outbox and Resend also want HTML, so this is the same words, line for line,
// in a plain block: no buttons, no colours, links left as the addresses they are.
export function renderPlainTextHtml(text: string) {
  const body = escapeHtml(text).replace(LINK_PATTERN, (link) => `<a href="${link}">${link}</a>`);
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:22px;color:#1b2420;white-space:pre-wrap">${body}</div>`;
}
