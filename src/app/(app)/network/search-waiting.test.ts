import { describe, expect, it } from "vitest";

import { formatElapsed, readWaitingNote } from "./search-waiting";

describe("the search waiting state", () => {
  it("counts real elapsed time", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(72)).toBe("1:12");
  });

  it("sets the honest expectation first", () => {
    expect(readWaitingNote(0)).toContain("often take a minute or more");
  });

  it("reassures during a long wait", () => {
    expect(readWaitingNote(50)).toContain("nothing has gone wrong");
  });

  it("says when it will give up", () => {
    expect(readWaitingNote(110)).toContain("two minutes");
  });
});
