export const NEW_POST_POLL_MS = 30_000;
export const NEW_POST_POLL_AFTER_FAILURE_MS = 120_000;

export function readNewPostPollMs(hasFailed: boolean) {
  return hasFailed ? NEW_POST_POLL_AFTER_FAILURE_MS : NEW_POST_POLL_MS;
}

export function describeNewPosts(newPostCount: number) {
  return newPostCount === 1 ? "1 new post" : `${newPostCount} new posts`;
}
