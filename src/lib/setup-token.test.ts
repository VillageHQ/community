import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { readSetupToken } from "./setup-token";

const GENERATED_SAMPLES = 20_000;
const TOKEN_BYTES = 16;

function generateToken(byteCount = TOKEN_BYTES) {
  return randomBytes(byteCount).toString("hex");
}

describe("readSetupToken", () => {
  describe("with generated tokens", () => {
    it("accepts every openssl-style 16-byte hex sample", () => {
      const rejected = Array.from({ length: GENERATED_SAMPLES }, () => generateToken()).filter(
        (token) => readSetupToken({ SETUP_TOKEN: token }) === null,
      );

      expect(rejected).toEqual([]);
    });

    it("accepts a 32-byte hex token", () => {
      const token = generateToken(32);

      expect(readSetupToken({ SETUP_TOKEN: token })).toBe(token);
    });
  });

  describe("with weak tokens", () => {
    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["too short", generateToken().slice(0, -1)],
      ["one repeated character", "a".repeat(64)],
      ["a short repeated pattern", "abc123".repeat(10)],
      ["a repeated word", "password1password1password1password1"],
      ["a repeated phrase", "villagecommunityvillagecommunity"],
      ["a repeated phrase cut short", "villagecommunityvillagecommunit"],
      ["a repeated phrase with a suffix", "villagecommunityvillagecommunity!9"],
    ])("rejects a token that is %s", (_case, token) => {
      expect(readSetupToken({ SETUP_TOKEN: token })).toBeNull();
    });
  });
});
