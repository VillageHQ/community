import { describe, expect, it } from "vitest";

import { nextConfig } from "../../next.config.mjs";

async function readSecurityHeaders() {
  const [rule] = await nextConfig.headers();
  return new Map(rule?.headers.map(({ key, value }) => [key, value]));
}

describe("security headers", () => {
  it("apply to every path", async () => {
    const [rule] = await nextConfig.headers();

    expect(rule?.source).toBe("/:path*");
  });

  it("block framing", async () => {
    const headers = await readSecurityHeaders();

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("restrict objects, base URLs and form targets without a script policy", async () => {
    const policy = (await readSecurityHeaders()).get("Content-Security-Policy");

    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).not.toContain("script-src");
  });

  it("keep the referrer origin for the Village SDK", async () => {
    const headers = await readSecurityHeaders();

    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
