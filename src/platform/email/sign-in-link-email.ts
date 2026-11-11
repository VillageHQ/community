import { toSingleLine } from "./email-text.ts";
import { renderPlainTextHtml } from "./plain-text-email.ts";

export const SIGN_IN_LINK_LIFETIME_SECONDS = 15 * 60;

type SignInLinkEmailFacts = { link: string; communityName: string };

// Founderhall's sign-in link email, word for word (copy/emails/email-signin-link.md). "… for <community>", never
// "Your <community> sign-in link": the default name is "Your community".
export function renderSignInLinkEmail({ link, communityName }: SignInLinkEmailFacts) {
  const community = toSingleLine(communityName);
  const subject = `Your sign-in link for ${community}`;
  const text = [
    "Hi,",
    "",
    `Open this link to sign in to ${community}:`,
    link,
    "",
    "It works once, for the next 15 minutes. If you did not ask for it, ignore this email.",
    "",
    `Sent by ${community} via its member portal.`,
  ].join("\n");
  return { subject, html: renderPlainTextHtml(text), text };
}
