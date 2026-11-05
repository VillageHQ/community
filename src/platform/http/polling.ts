const SECOND_MS = 1000;

export const INBOX_POLL_MS = 30 * SECOND_MS;

export const INBOX_POLL_AFTER_FAILURE_MS = 120 * SECOND_MS;

export function readInboxPollMs(hasFailed: boolean) {
  return hasFailed ? INBOX_POLL_AFTER_FAILURE_MS : INBOX_POLL_MS;
}
