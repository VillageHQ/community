import { describe, expect, it } from "vitest";

import { describeNewPosts, NEW_POST_POLL_AFTER_FAILURE_MS, NEW_POST_POLL_MS, readNewPostPollMs } from "./new-post-polling";

describe("the new post check", () => {
  it("polls at the regular interval", () => {
    expect(readNewPostPollMs(false)).toBe(NEW_POST_POLL_MS);
  });

  it("slows down after a failure, to a bound", () => {
    expect(readNewPostPollMs(true)).toBe(NEW_POST_POLL_AFTER_FAILURE_MS);
    expect(NEW_POST_POLL_AFTER_FAILURE_MS).toBeGreaterThan(NEW_POST_POLL_MS);
  });

  it("describes the count with correct grammar", () => {
    expect(describeNewPosts(1)).toBe("1 new post");
    expect(describeNewPosts(3)).toBe("3 new posts");
  });
});
