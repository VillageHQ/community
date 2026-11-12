import { describe, expect, it, vi } from "vitest";

import { FLY_CLIENT_IP_WARNING, readRateLimitClientKey, resolveClientIpHeaders, warnWhenFlyLacksClientIpHeader } from "./client-ip";

describe("resolveClientIpHeaders", () => {
  it("prefers an explicit CLIENT_IP_HEADER", () => {
    expect(resolveClientIpHeaders({ CLIENT_IP_HEADER: "CF-Connecting-IP", VERCEL: "1" })).toEqual([
      "cf-connecting-ip",
    ]);
  });

  it("uses Vercel's header on Vercel", () => {
    expect(resolveClientIpHeaders({ VERCEL: "1" })).toEqual(["x-vercel-forwarded-for"]);
  });

  it("uses X-Real-IP on Railway", () => {
    expect(resolveClientIpHeaders({ RAILWAY_PROJECT_ID: "project" })).toEqual(["x-real-ip"]);
  });

  it("trusts no header elsewhere", () => {
    expect(resolveClientIpHeaders({})).toEqual([]);
  });
});

describe("readRateLimitClientKey", () => {
  const VERCEL = { VERCEL: "1" };

  function createRequest(headers: Record<string, string>) {
    return new Request("http://localhost/api/setup", { headers });
  }

  it("reads the trusted header", () => {
    const request = createRequest({ "x-vercel-forwarded-for": "203.0.113.9" });

    expect(readRateLimitClientKey(request, VERCEL)).toBe("203.0.113.9");
  });

  it("groups IPv6 clients by /64", () => {
    const first = createRequest({ "x-vercel-forwarded-for": "2001:db8:1:2::1" });
    const second = createRequest({ "x-vercel-forwarded-for": "2001:db8:1:2::2" });

    expect(readRateLimitClientKey(first, VERCEL)).toBe(readRateLimitClientKey(second, VERCEL));
  });

  it("does not let X-Forwarded-For choose the key", () => {
    const first = createRequest({ "x-forwarded-for": "198.51.100.1" });
    const second = createRequest({ "x-forwarded-for": "198.51.100.2" });

    expect(readRateLimitClientKey(first, {})).toBe(readRateLimitClientKey(second, {}));
  });
});

describe("warnWhenFlyLacksClientIpHeader", () => {
  it("warns on Fly without CLIENT_IP_HEADER", () => {
    const warn = vi.fn();
    expect(warnWhenFlyLacksClientIpHeader({ FLY_APP_NAME: "community" }, warn)).toBe(true);
    expect(warn).toHaveBeenCalledWith(FLY_CLIENT_IP_WARNING);
    expect(FLY_CLIENT_IP_WARNING).toContain("CLIENT_IP_HEADER=fly-client-ip");
  });

  it("stays quiet with CLIENT_IP_HEADER set, or off Fly", () => {
    const warn = vi.fn();
    expect(warnWhenFlyLacksClientIpHeader({ FLY_APP_NAME: "community", CLIENT_IP_HEADER: "fly-client-ip" }, warn)).toBe(false);
    expect(warnWhenFlyLacksClientIpHeader({}, warn)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
