import { describe, expect, it } from "vitest";

import { addStrictTransport, readStrictTransportValue, STRICT_TRANSPORT_HEADER, STRICT_TRANSPORT_VALUE } from "./strict-transport";

describe("Strict-Transport-Security", () => {
  it("is sent when the app runs on https", () => {
    expect(readStrictTransportValue({ NODE_ENV: "production", APP_URL: "https://community.example.com" })).toBe(STRICT_TRANSPORT_VALUE);
    expect(STRICT_TRANSPORT_VALUE).toMatch(/max-age=\d{8,}; includeSubDomains/);
  });

  it("is never sent on plain http (local development)", () => {
    expect(readStrictTransportValue({ APP_URL: "http://localhost:3000" })).toBeNull();
    expect(readStrictTransportValue({})).toBeNull();
  });

  it("is not sent when the app's address can't be worked out", () => {
    expect(readStrictTransportValue({ NODE_ENV: "production" })).toBeNull();
  });

  it("is set on a response", () => {
    const response = addStrictTransport(new Response("ok"), { APP_URL: "https://community.example.com" });
    expect(response.headers.get(STRICT_TRANSPORT_HEADER)).toBe(STRICT_TRANSPORT_VALUE);
    expect(addStrictTransport(new Response("ok"), { APP_URL: "http://localhost:3000" }).headers.has(STRICT_TRANSPORT_HEADER)).toBe(false);
  });
});
