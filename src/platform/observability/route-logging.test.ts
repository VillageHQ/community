import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { instanceSettings } from "@/platform/settings/schema";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { readErrorReason, withRouteLogging } from "./route-logging";

const SENSITIVE_PARAM = "sensitive-param-value";

describe("withRouteLogging", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await database.$client.end();
  });

  describe("when a query fails", () => {
    it("responds 500 and keeps query params out of logs", async () => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const row = { key: "duplicate", value: SENSITIVE_PARAM };
      await database.insert(instanceSettings).values(row);

      const route = withRouteLogging("test", async () => {
        await database.insert(instanceSettings).values(row);
        return new Response();
      });
      const response = await route();
      const logLine = JSON.stringify(logged.mock.calls);

      expect(response.status).toBe(500);
      expect(logLine).toContain("duplicate key");
      expect(logLine).not.toContain(SENSITIVE_PARAM);
      expect(await response.text()).not.toContain("duplicate key");
    });
  });
});

describe("readErrorReason", () => {
  it("prefers the wrapped cause", () => {
    const cause = new Error("permission denied for schema public");
    const error = new Error("Failed query: create table\nparams: secret", { cause });

    expect(readErrorReason(error)).toBe("permission denied for schema public");
  });

  it("falls back to the message", () => {
    expect(readErrorReason(new Error("connect ECONNREFUSED"))).toBe("connect ECONNREFUSED");
  });

  it("handles values that are not errors", () => {
    expect(readErrorReason("nope")).toBe("Unknown error");
  });
});
