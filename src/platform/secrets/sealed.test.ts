import { describe, expect, it } from "vitest";

import { isSealedValue, openSealedSecret, sealSecret } from "./sealed";

const TOKEN = "a-strong-setup-token-with-more-than-32-characters";
const OTHER_TOKEN = "a-different-setup-token-with-more-than-32-characters";
const SECRET = "village-secret-key";
const LABEL = "village_secret_key";

describe("a sealed secret", () => {
  it("opens with the same token and label", async () => {
    const sealed = await sealSecret(SECRET, TOKEN, LABEL);

    expect(await openSealedSecret(sealed, TOKEN, LABEL)).toBe(SECRET);
  });

  it("doesn't show the secret", async () => {
    const sealed = await sealSecret(SECRET, TOKEN, LABEL);

    expect(sealed).not.toContain(SECRET);
    expect(isSealedValue(sealed)).toBe(true);
  });

  it("differs every time, so equal secrets don't look equal", async () => {
    expect(await sealSecret(SECRET, TOKEN, LABEL)).not.toBe(await sealSecret(SECRET, TOKEN, LABEL));
  });

  it("won't open with another token", async () => {
    const sealed = await sealSecret(SECRET, TOKEN, LABEL);

    expect(await openSealedSecret(sealed, OTHER_TOKEN, LABEL)).toBeNull();
  });

  it("won't open when copied to another setting", async () => {
    const sealed = await sealSecret(SECRET, TOKEN, LABEL);

    expect(await openSealedSecret(sealed, TOKEN, "another_setting")).toBeNull();
  });

  it("won't open after tampering", async () => {
    const sealed = await sealSecret(SECRET, TOKEN, LABEL);
    const parts = sealed.split(".");
    const encrypted = Buffer.from(parts.at(-1) ?? "", "base64url");
    encrypted.writeUInt8(encrypted.readUInt8(0) ^ 1, 0);
    const tampered = [...parts.slice(0, -1), encrypted.toString("base64url")].join(".");

    expect(await openSealedSecret(tampered, TOKEN, LABEL)).toBeNull();
  });

  it.each(["sealed.v1.", "sealed.v1.a.b", "sealed.v1.a.b.c.d", "sealed.v1.a.b.c"])("reads %s as unreadable, not as a crash", async (value) => {
    expect(await openSealedSecret(value, TOKEN, LABEL)).toBeNull();
  });

  it("doesn't treat a plain key as sealed", () => {
    expect(isSealedValue("sk_live_abc")).toBe(false);
  });
});
