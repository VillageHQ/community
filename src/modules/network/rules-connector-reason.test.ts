import { describe, expect, it } from "vitest";

import { readScoreMetaReason, readSummaryReason, readThroughReason, readUnexplainedReason } from "./rules-connector-reason";

const MAXIMUM_LENGTH = 600;

describe("the connector reason", () => {
  it("drops the employee count and keeps the story", () => {
    const reason = readScoreMetaReason(
      [{ title: "Work", description: "Both worked at Corvane (1,000 employees) 2017 - 2021. Jonas as CTO while Clara as VP" }],
      MAXIMUM_LENGTH,
    );

    expect(reason).toBe("Both worked at Corvane 2017 - 2021. Jonas as CTO while Clara as VP.");
  });

  it("drops a sentence about roles when both are empty", () => {
    const reason = readScoreMetaReason(
      [{ title: "Work", description: "Both worked at Corvane  . Jonas as  while Clara as " }],
      MAXIMUM_LENGTH,
    );

    expect(reason).not.toContain(" as ");
    expect(reason).toContain("Both worked at Corvane");
  });

  it("leads with the strongest kind of reason", () => {
    const reason = readScoreMetaReason(
      [
        { title: "LinkedIn", description: "Both are connected on LinkedIn" },
        { title: "Verified interactions", description: "They met twice" },
      ],
      MAXIMUM_LENGTH,
    );

    expect(reason).toBe("They met twice. Both are connected on LinkedIn.");
  });

  it("uses at most two reasons", () => {
    const reason = readScoreMetaReason(
      [
        { title: "Work", description: "One" },
        { title: "Manual", description: "Two" },
        { title: "LinkedIn", description: "Three" },
      ],
      MAXIMUM_LENGTH,
    );

    expect(reason).toBe("One. Two.");
  });

  it("gives nothing when Village gives nothing", () => {
    expect(readScoreMetaReason([], MAXIMUM_LENGTH)).toBe("");
    expect(readScoreMetaReason(null, MAXIMUM_LENGTH)).toBe("");
  });

  it("strips emoji and the via note from a summary", () => {
    expect(readSummaryReason("🟢 Jonas Lindqvist can intro (via Amara Osei)", MAXIMUM_LENGTH)).toBe("Jonas Lindqvist can intro.");
  });

  it("doesn't pass a rating or a label off as a reason", () => {
    expect(readSummaryReason("🟢 Direct connection", MAXIMUM_LENGTH)).toBe("");
    expect(readSummaryReason("Community member", MAXIMUM_LENGTH)).toBe("");
  });

  it("strips bidirectional controls from Village's text", () => {
    expect(readScoreMetaReason([{ title: "Work", description: "Good‮money" }], MAXIMUM_LENGTH)).toBe("Goodmoney.");
  });

  it("strips bidirectional controls from names in the sentences we write", () => {
    expect(readThroughReason("No\u202Eor Haddad", "De\u2066le Adeyemi", "Cl\u202Eara Bergström")).toBe("Noor knows Dele Adeyemi, who can reach Clara.");
    expect(readUnexplainedReason("Jo\u202Enas Lindqvist", "Cl\u202Eara Bergström")).not.toMatch(/\u202E/);
  });

  it("admits it when Village doesn't say how they know each other", () => {
    expect(readUnexplainedReason("Jonas Lindqvist", "Clara Bergström")).toContain("didn't say how they know each other");
  });

  it("says who a connector reaches the target through", () => {
    expect(readThroughReason("Noor Haddad", "Dele Adeyemi", "Clara Bergström")).toBe("Noor knows Dele Adeyemi, who can reach Clara.");
  });
});
