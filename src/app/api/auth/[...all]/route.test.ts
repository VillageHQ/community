import { beforeEach, describe, expect, it } from "vitest";

import { rateLimit } from "@/database/auth-schema";
import { clearDatabase, createTestDatabase } from "@/test/database";

import { GET, POST } from "./route";

const APP_URL = "http://localhost:3000";
const LONG_SEGMENT = "a".repeat(8_000);
const JSON_HEADERS = { "Content-Type": "application/json", Origin: APP_URL };

function postAuth(path: string) {
  return POST(
    new Request(`${APP_URL}/api/auth/${path}`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: "{}",
    }),
  );
}

describe("/api/auth route", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  describe("with an unknown path", () => {
    it("responds 404 and creates no rate limit row", async () => {
      const first = await postAuth(`${LONG_SEGMENT}-1`);
      const second = await postAuth("does-not-exist");

      expect(first.status).toBe(404);
      expect(second.status).toBe(404);
      expect(await database.select().from(rateLimit)).toEqual([]);
    });
  });

  describe("with a parameterized path", () => {
    it("responds 404 and creates no rate limit row", async () => {
      const response = await GET(new Request(`${APP_URL}/api/auth/reset-password/${LONG_SEGMENT}`));

      expect(response.status).toBe(404);
      expect(await database.select().from(rateLimit)).toEqual([]);
    });
  });

  describe("with a known path", () => {
    it("reaches Better Auth", async () => {
      const response = await GET(new Request(`${APP_URL}/api/auth/get-session`));

      expect(response.status).toBe(200);
    });

    it("keeps the rate limit on sign-in", async () => {
      const response = await postAuth("sign-in/email");

      expect(response.status).not.toBe(404);
      expect(await database.select().from(rateLimit)).toHaveLength(1);
    });
  });
});
