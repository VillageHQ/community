import { describe, expect, it, vi } from "vitest";

import { createDatabase, createPoolConfig } from "./client";

const DIRECT_URL = "postgres://app@db.example/app";
const NEON_POOLED_URL = "postgres://app@ep-cool-name-pooler.us-east-1.aws.neon.tech/app";

describe("createPoolConfig", () => {
  it("bounds every query on the client", () => {
    expect(createPoolConfig(DIRECT_URL, {}).query_timeout).toBeGreaterThan(0);
    expect(createPoolConfig(NEON_POOLED_URL, {}).query_timeout).toBeGreaterThan(0);
  });

  it("asks the server to bound statements on a direct connection", () => {
    expect(createPoolConfig(DIRECT_URL, {})).toHaveProperty("statement_timeout");
  });

  describe("behind a transaction pooler", () => {
    it("omits statement_timeout for a pooler hostname", () => {
      expect(createPoolConfig(NEON_POOLED_URL, {})).not.toHaveProperty("statement_timeout");
    });

    it("omits statement_timeout when an unpooled URL also exists", () => {
      expect(
        createPoolConfig(DIRECT_URL, { DATABASE_URL_UNPOOLED: "postgres://direct/app" }),
      ).not.toHaveProperty("statement_timeout");
    });
  });
});

describe("createDatabase", () => {
  it("logs idle pool errors instead of crashing the process", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const database = createDatabase(DIRECT_URL, {});

    database.$client.emit("error", new Error("idle client lost"));

    expect(JSON.stringify(logged.mock.calls)).toContain("idle client lost");
    logged.mockRestore();
    await database.$client.end();
  });
});
