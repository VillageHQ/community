import { toSingleLine } from "./email-text.ts";
import { renderPlainTextHtml } from "./plain-text-email.ts";

export const PASSWORD_RESET_LIFETIME_SECONDS = 3_600;

type PasswordResetEmailFacts = { link: string; communityName: string };

// Community-only (Founderhall has no passwords), written as Founderhall writes its emails: plain text, the same frame
// as the sign-in link email.
export function renderPasswordResetEmail({ link, communityName }: PasswordResetEmailFacts) {
  const community = toSingleLine(communityName);
  const subject = `Reset your password for ${community}`;
  const text = [
    "Hi,",
    "",
    `Open this link to choose a new password for ${community}:`,
    link,
    "",
    "It works once, for the next hour. If you did not ask for it, ignore this email and nothing changes.",
    "",
    `Sent by ${community} via its member portal.`,
  ].join("\n");
  return { subject, html: renderPlainTextHtml(text), text };
}
