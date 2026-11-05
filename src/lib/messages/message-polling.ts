const SECOND_MS = 1000;

export const THREAD_POLL_MS = 4 * SECOND_MS;
export const THREAD_POLL_AFTER_FAILURE_MS = 30 * SECOND_MS;
export const THREAD_CATCH_UP_POLL_MS = SECOND_MS / 4;
export const INBOX_POLL_MS = 30 * SECOND_MS;
export const INBOX_POLL_AFTER_FAILURE_MS = 120 * SECOND_MS;

type ThreadPollState = { hasFailed: boolean; hasMore: boolean };

export function readThreadPollMs({ hasFailed, hasMore }: ThreadPollState) {
  if (hasFailed) return THREAD_POLL_AFTER_FAILURE_MS;
  return hasMore ? THREAD_CATCH_UP_POLL_MS : THREAD_POLL_MS;
}

export function readInboxPollMs(hasFailed: boolean) {
  return hasFailed ? INBOX_POLL_AFTER_FAILURE_MS : INBOX_POLL_MS;
}
