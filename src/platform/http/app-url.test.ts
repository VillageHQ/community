import { describe, expect, it } from "vitest";

import { resolveAppUrl, resolveTrustedOrigins } from "./app-url";

const PRODUCTION = { NODE_ENV: "production" };

describe("resolveAppUrl", () => {
  describe("with an explicit APP_URL", () => {
    it("prefers it over every platform variable", () => {
      expect(
        resolveAppUrl({
          ...PRODUCTION,
          APP_URL: "https://community.example.com",
          RAILWAY_PUBLIC_DOMAIN: "web.up.railway.app",
          VERCEL_PROJECT_PRODUCTION_URL: "community.vercel.app",
        }),
      ).toBe("https://community.example.com");
    });

    it("drops trailing slashes and paths", () => {
      expect(resolveAppUrl({ APP_URL: "https://community.example.com/path/" })).toBe(
        "https://community.example.com",
      );
    });

    it("rejects a value that is not a URL", () => {
      expect(() => resolveAppUrl({ APP_URL: "not a url" })).toThrow();
    });
  });

  describe("on Railway", () => {
    it("uses the public domain over https", () => {
      expect(
        resolveAppUrl({
          ...PRODUCTION,
          RAILWAY_PUBLIC_DOMAIN: "web.up.railway.app",
          VERCEL_PROJECT_PRODUCTION_URL: "community.vercel.app",
        }),
      ).toBe("https://web.up.railway.app");
    });
  });

  describe("on Vercel", () => {
    it("uses the production URL over https in production", () => {
      expect(
        resolveAppUrl({
          ...PRODUCTION,
          VERCEL_ENV: "production",
          VERCEL_URL: "community-abc123.vercel.app",
          VERCEL_PROJECT_PRODUCTION_URL: "community.vercel.app",
        }),
      ).toBe("https://community.vercel.app");
    });

    it("uses the deployment's own URL on previews", () => {
      expect(
        resolveAppUrl({
          ...PRODUCTION,
          VERCEL_ENV: "preview",
          VERCEL_URL: "community-abc123.vercel.app",
          VERCEL_PROJECT_PRODUCTION_URL: "community.vercel.app",
        }),
      ).toBe("https://community-abc123.vercel.app");
    });
  });

  describe("without any URL", () => {
    it("falls back to localhost outside production", () => {
      expect(resolveAppUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    });

    it("throws in production", () => {
      expect(() => resolveAppUrl(PRODUCTION)).toThrow("APP_URL");
    });
  });
});

describe("resolveTrustedOrigins", () => {
  it("trusts only the app URL in production", () => {
    expect(
      resolveTrustedOrigins({
        ...PRODUCTION,
        VERCEL_ENV: "production",
        VERCEL_URL: "community-abc123.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "community.vercel.app",
      }),
    ).toEqual(["https://community.vercel.app"]);
  });

  it("adds the preview deployment's own URL and never a wildcard", () => {
    const origins = resolveTrustedOrigins({
      ...PRODUCTION,
      APP_URL: "https://community.example.com",
      VERCEL_ENV: "preview",
      VERCEL_URL: "community-abc123.vercel.app",
    });

    expect(origins).toEqual([
      "https://community.example.com",
      "https://community-abc123.vercel.app",
    ]);
    expect(origins.join()).not.toContain("*");
  });
});
