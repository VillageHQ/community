import { describe, expect, it } from "vitest";

import { secretsMatch } from "./secrets-match";

describe("secretsMatch", () => {
  it("accepts identical values", () => {
    expect(secretsMatch("correct-horse", "correct-horse")).toBe(true);
  });

  it("rejects a value of the same length", () => {
    expect(secretsMatch("correct-horsf", "correct-horse")).toBe(false);
  });

  it("rejects a value of a different length without throwing", () => {
    expect(secretsMatch("short", "correct-horse")).toBe(false);
  });
});
