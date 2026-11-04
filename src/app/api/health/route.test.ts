import { createServer, type Server } from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDisposableDatabase } from "@/test/database";

const UNREACHABLE_DATABASE_URL = "postgres://secret-user:secret-password@127.0.0.1:1/unreachable";
const HEALTH_DEADLINE_BOUND_MS = 4_900;

async function requestHealth() {
  vi.resetModules();
  const { GET } = await import("./route");
  return GET();
}

describe("GET /api/health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("with a reachable, migrated database", () => {
    it("responds 200 with the status only", async () => {
      const response = await requestHealth();

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    });
  });

  describe("with an unmigrated database", () => {
    it("responds 503", async () => {
      const disposable = await createDisposableDatabase();
      vi.stubEnv("DATABASE_URL", disposable.connectionString);

      const response = await requestHealth();

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ status: "unavailable" });

      await disposable.destroy();
    });
  });

  describe("with an unreachable database", () => {
    it("responds 503 without leaking the connection string", async () => {
      vi.stubEnv("DATABASE_URL", UNREACHABLE_DATABASE_URL);
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await requestHealth();
      const body = await response.text();

      expect(response.status).toBe(503);
      expect(JSON.parse(body)).toEqual({ status: "unavailable" });
    });
  });

  describe("with a database that accepts connections and never answers", () => {
    let silentServer: Server;

    beforeEach(async () => {
      silentServer = createServer();
      await new Promise<void>((resolve) => silentServer.listen(0, "127.0.0.1", resolve));
    });

    afterEach(() => {
      silentServer.close();
    });

    it("responds 503 within the deadline", async () => {
      const address = silentServer.address();
      if (address === null || typeof address === "string") throw new Error("Expected a TCP port.");
      vi.stubEnv("DATABASE_URL", `postgres://user:password@127.0.0.1:${address.port}/silent`);
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const startedAt = Date.now();
      const response = await requestHealth();

      expect(response.status).toBe(503);
      expect(Date.now() - startedAt).toBeLessThan(HEALTH_DEADLINE_BOUND_MS);
    });
  });
});
