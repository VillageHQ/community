import { describe, expect, it } from "vitest";

import { readResponseMessage } from "./read-response-message";

const FALLBACK = "Something went wrong.";

describe("readResponseMessage", () => {
  it("returns the message from valid JSON", async () => {
    const response = Response.json({ message: "The setup token is wrong." });

    expect(await readResponseMessage(response, FALLBACK)).toBe("The setup token is wrong.");
  });

  it("falls back on a response that is not JSON", async () => {
    expect(await readResponseMessage(new Response("<html>"), FALLBACK)).toBe(FALLBACK);
  });

  it("falls back on JSON of another shape", async () => {
    expect(await readResponseMessage(Response.json({ message: 5 }), FALLBACK)).toBe(FALLBACK);
  });
});
