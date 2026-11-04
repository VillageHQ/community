import { describe, expect, it } from "vitest";

import { withDeadline } from "./with-deadline";

const SHORT_MS = 5;
const LONG_MS = 1_000;

describe("withDeadline", () => {
  it("returns the result of work that finishes in time", async () => {
    await expect(withDeadline(Promise.resolve("done"), LONG_MS, "late")).resolves.toBe("done");
  });

  it("rejects when work outlasts the deadline", async () => {
    const neverFinishes = new Promise(() => undefined);

    await expect(withDeadline(neverFinishes, SHORT_MS, "late")).rejects.toThrow("late");
  });
});
