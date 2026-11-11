import { toPossessive } from "../../platform/text/day-month.ts";

// Founderhall's Inbox words (copy/member-inbox-*.md, member-message-*.md), with the community's name.

export function describeAdminLine(communityName: string) {
  return `${toPossessive(communityName)} admins can’t read messages in the portal.`;
}

export function describeInboxLede(communityName: string) {
  return `Messages and intro threads. Reply here or by email; both land in the same thread. ${describeAdminLine(communityName)}`;
}

export function describeThreadLine(communityName: string) {
  return `Replies by email land here too. ${describeAdminLine(communityName)}`;
}

export const INBOX_EMPTY = {
  title: "No messages yet",
  before: "Open a member’s profile in the ",
  link: "directory",
  after: " and choose Message. Intro threads land here once both sides said yes.",
} as const;

export const NEW_THREAD_LINE = "No messages yet. Say hello.";

export const COMPOSER_LABEL = "Write a message";
