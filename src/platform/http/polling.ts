import { RequestFailure } from "./post-request.ts";

const SECOND_MS = 1000;
const NOT_FOUND_STATUS = 404;

export const INBOX_POLL_MS = 30 * SECOND_MS;

export const INBOX_POLL_AFTER_FAILURE_MS = 120 * SECOND_MS;

export function readInboxPollMs(hasFailed: boolean) {
  return hasFailed ? INBOX_POLL_AFTER_FAILURE_MS : INBOX_POLL_MS;
}

// An admin can turn a module off while a tab is open. Its routes then answer 404, so a badge stops asking.
export function readBadgePollMs({ state }: { state: { status: string; error: unknown } }) {
  if (state.error instanceof RequestFailure && state.error.status === NOT_FOUND_STATUS) return false;
  return readInboxPollMs(state.status === "error");
}
