import { describe, expect, it } from "vitest";

import { hasFirstAndLastName, namesMatch } from "./rules-name-match";

describe("matching a member's name to a Village profile", () => {
  it.each([
    ["Clara Bergström", "clara bergstrom"],
    ["JONÁS LINDQVIST", "Jonas Lindqvist"],
    ["Jonas Erik Lindqvist", "Jonas Lindqvist"],
    ["Søren Kierkegård", "Soren Kierkegard"],
    ["Conor O'Brien", "Conor OBrien"],
    ["Anne-Marie Smith", "Anne Smith"],
    ["Jonas\u202E Lindqvist", "Jonas Lindqvist"],
  ])("matches %s and %s", (first, second) => {
    expect(namesMatch(first, second)).toBe(true);
  });

  it.each([
    ["Mallory Fake", "Jonas Lindqvist"],
    ["Jonas Fake", "Jonas Lindqvist"],
    ["Mallory Lindqvist", "Jonas Lindqvist"],
    ["Lindqvist Jonas", "Jonas Lindqvist"],
    ["Jonas", "Jonas Lindqvist"],
    ["Jonas Lindqvist", ""],
    ["Jonas Lindqvist", "Jonаs Lindqvist"],
  ])("doesn't match %s and %s", (first, second) => {
    expect(namesMatch(first, second)).toBe(false);
  });

  it("knows when a name could never match", () => {
    expect(hasFirstAndLastName("Jonas")).toBe(false);
    expect(hasFirstAndLastName("Jonas Lindqvist")).toBe(true);
  });
});
