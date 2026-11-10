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

  it.each(["/api/branding/logo", "/api/members/:memberId/avatar"])(
    "sandbox uploaded images at %s, and keep the framing rules",
    async (path) => {
      const rules = await nextConfig.headers();
      const imageRule = rules.find(({ source }) => source === path);
      const policy = imageRule?.headers.find(({ key }) => key === "Content-Security-Policy")?.value;

      expect(policy).toContain("default-src 'none'");
      expect(policy).toContain("sandbox");
      expect(policy).toContain("frame-ancestors 'none'");
    },
  );

  it.each(["/perks", "/admin/perks"])("let %s frame BuiltFirst only, and keep the framing rules", async (path) => {
    const rules = await nextConfig.headers();
    const policy = rules.find(({ source }) => source === path)?.headers.find(({ key }) => key === "Content-Security-Policy")?.value;

    expect(policy).toContain("frame-src https://builtfirst.com https://*.builtfirst.com;");
    expect(policy).toContain("frame-ancestors 'none'");
    expect((await readSecurityHeaders()).get("Content-Security-Policy")).not.toContain("builtfirst");
  });

  it.each(["/join/:token", "/meet/:token", "/confirm-email", "/reset-password"])("keep tokens at %s out of referrers and search engines", async (path) => {
    const rules = await nextConfig.headers();
    const inviteRule = rules.find(({ source }) => source === path);

    expect(inviteRule?.headers).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" });
    expect(inviteRule?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex" });
  });
});
