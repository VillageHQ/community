import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { nextConfig } from "../../next.config.mjs";

// The matcher Next itself uses for header sources. It ships without types.
const { pathToRegexp } = createRequire(import.meta.url)("next/dist/compiled/path-to-regexp") as {
  pathToRegexp: (source: string, keys: unknown[], options: { strict: boolean; sensitive: boolean; delimiter: string }) => RegExp;
};

const WIDGET_FRAME_PATH = "/api/job-board/embed";

function matchesSource(source: string, path: string) {
  return pathToRegexp(source, [], { strict: true, sensitive: false, delimiter: "/" }).test(path);
}

async function readSecurityHeaders() {
  const [rule] = await nextConfig.headers();
  return new Map(rule?.headers.map(({ key, value }) => [key, value]));
}

describe("security headers", () => {
  it.each(["/", "/members", "/api/job-board/widget.js", "/api/job-board/embed/extra", "/public/jobs", "/admin/jobs"])("apply to %s", async (path) => {
    const [rule] = await nextConfig.headers();

    expect(matchesSource(rule?.source ?? "", path)).toBe(true);
  });

  it("let any site frame the job widget's frame, and only it", async () => {
    const rules = await nextConfig.headers();
    const [everyPath] = rules;
    const frameRule = rules.find(({ source }) => source === WIDGET_FRAME_PATH);
    const policy = frameRule?.headers.find(({ key }) => key === "Content-Security-Policy")?.value;

    expect(matchesSource(everyPath?.source ?? "", WIDGET_FRAME_PATH)).toBe(false);
    expect(policy).toContain("frame-ancestors *");
    expect(policy).toContain("script-src 'self'");
    expect(frameRule?.headers.some(({ key }) => key === "X-Frame-Options")).toBe(false);
    expect(rules.filter(({ headers }) => headers.some(({ value }) => value.includes("frame-ancestors *")))).toHaveLength(1);
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

  it.each(["/invite", "/auth", "/join/:token", "/meet/:token", "/confirm-email", "/reset-password"])("keep tokens at %s out of referrers and search engines", async (path) => {
    const rules = await nextConfig.headers();
    const inviteRule = rules.find(({ source }) => source === path);

    expect(inviteRule?.headers).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" });
    expect(inviteRule?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex" });
  });
});
