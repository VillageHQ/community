import { beforeEach, describe, expect, it, vi } from "vitest";

import { looksSealed, openSealedSecret, OPEN_OUTCOMES, sealSecret } from "./sealed";

const scryptControl = vi.hoisted(() => ({ calls: 0, failNext: false }));

vi.mock("node:crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:crypto")>();
  return {
    ...original,
    scrypt: (password: string, salt: Buffer, length: number, options: object, callback: (error: Error | null, key: Buffer) => void) => {
      scryptControl.calls += 1;
      if (!scryptControl.failNext) return original.scrypt(password, salt, length, options, callback);
      scryptControl.failNext = false;
      callback(new Error("Out of memory."), Buffer.alloc(0));
    },
  };
});

const TOKEN = "a-strong-setup-token-with-more-than-32-characters";
const OTHER_TOKEN = "a-different-setup-token-with-more-than-32-characters";
const SECRET = "village-secret-key";
const LABEL = "village_secret_key";
const CONCURRENT_CALLERS = 20;

function uniqueToken() {
  return `${TOKEN}-${crypto.randomUUID()}`;
}

describe("a sealed secret", () => {
  beforeEach(() => {
    scryptControl.calls = 0;
    scryptControl.failNext = false;
  });

  it("opens with the same token and label", async () => {
    const sealed = await sealSecret(SECRET, TOKEN, LABEL);

    expect(await openSealedSecret(sealed, TOKEN, LABEL)).toEqual({ outcome: OPEN_OUTCOMES.opened, secret: SECRET });
  });

  it("doesn't show the secret", async () => {
    const sealed = await sealSecret(SECRET, TOKEN, LABEL);

    expect(sealed).not.toContain(SECRET);
    expect(looksSealed(sealed)).toBe(true);
  });

  it("differs every time, so equal secrets don't look equal", async () => {
    expect(await sealSecret(SECRET, TOKEN, LABEL)).not.toBe(await sealSecret(SECRET, TOKEN, LABEL));
  });

  it("won't open with another token", async () => {
    const sealed = await sealSecret(SECRET, TOKEN, LABEL);

    expect(await openSealedSecret(sealed, OTHER_TOKEN, LABEL)).toEqual({ outcome: OPEN_OUTCOMES.wrongToken });
  });

  it("won't open when copied to another setting", async () => {
    const sealed = await sealSecret(SECRET, TOKEN, LABEL);

    expect(await openSealedSecret(sealed, TOKEN, "another_setting")).toEqual({ outcome: OPEN_OUTCOMES.wrongToken });
  });

  it("won't open after tampering", async () => {
    const sealed = await sealSecret(SECRET, TOKEN, LABEL);
    const parts = sealed.split(".");
    const encrypted = Buffer.from(parts.at(-1) ?? "", "base64url");
    encrypted.writeUInt8(encrypted.readUInt8(0) ^ 1, 0);
    const tampered = [...parts.slice(0, -1), encrypted.toString("base64url")].join(".");

    expect(await openSealedSecret(tampered, TOKEN, LABEL)).toEqual({ outcome: OPEN_OUTCOMES.wrongToken });
  });

  describe("a value this build can't read", () => {
    it.each(["sealed.v1.", "sealed.v1.a.b", "sealed.v1.a.b.c.d", "sealed.v1.a.b.c", "sealed.v2.a.b.c", "sealed.anything"])("treats %s as unsupported, without deriving a key", async (value) => {
      expect(await openSealedSecret(value, TOKEN, LABEL)).toEqual({ outcome: OPEN_OUTCOMES.unsupported });
      expect(scryptControl.calls).toBe(0);
    });

    it.each(["sealed.v2.a.b.c", "sealed.", "sealed.key-from-somewhere"])("never reads %s as a plain key", (value) => {
      expect(looksSealed(value)).toBe(true);
    });

    it("reads an ordinary key as plain", () => {
      expect(looksSealed("sk_live_abc")).toBe(false);
    });
  });

  describe("deriving the key", () => {
    it("runs once for callers at the same moment", async () => {
      const token = uniqueToken();
      const sealed = await sealSecret(SECRET, token, LABEL);
      await Promise.all(Array.from({ length: CONCURRENT_CALLERS }, () => sealSecret(SECRET, token, LABEL)));
      await Promise.all(Array.from({ length: CONCURRENT_CALLERS }, () => openSealedSecret(sealed, token, LABEL)));

      expect(scryptControl.calls).toBe(1);
    });

    it("doesn't blame the token when derivation fails", async () => {
      const token = uniqueToken();
      const sealed = await sealSecret(SECRET, token, LABEL);
      const otherSalted = sealed.replace(/^sealed\.v1\.[^.]+/, `sealed.v1.${Buffer.from(crypto.randomUUID()).toString("base64url")}`);
      scryptControl.failNext = true;

      expect(await openSealedSecret(otherSalted, token, LABEL)).toEqual({ outcome: OPEN_OUTCOMES.derivationFailed });
    });

    it("forgets a failure, so the right token works on the next try", async () => {
      const token = uniqueToken();
      const sealedAgain = await sealSecret(SECRET, token, LABEL);
      globalThis.communitySealingKeys?.clear();
      scryptControl.failNext = true;

      expect(await openSealedSecret(sealedAgain, token, LABEL)).toEqual({ outcome: OPEN_OUTCOMES.derivationFailed });
      expect(await openSealedSecret(sealedAgain, token, LABEL)).toEqual({ outcome: OPEN_OUTCOMES.opened, secret: SECRET });
    });

    it("shares keys across bundles of this file in one process", async () => {
      const token = uniqueToken();
      const sealed = await sealSecret(SECRET, token, LABEL);
      vi.resetModules();
      const anotherBundle = await import("./sealed");

      expect(await anotherBundle.openSealedSecret(sealed, token, LABEL)).toEqual({ outcome: OPEN_OUTCOMES.opened, secret: SECRET });
      expect(scryptControl.calls).toBe(1);
    });
  });
});
