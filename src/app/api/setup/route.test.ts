import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rateLimit, user } from "@/database/auth-schema";
import { clearDatabase, createTestDatabase } from "@/test/database";

import { POST } from "./route";

const SETUP_TOKEN = randomBytes(16).toString("hex");
const FAILED_ATTEMPTS_PER_WINDOW = 10;
const WINDOW_START = Date.UTC(2026, 10, 4);
const ATTACKER_INTERVAL_MS = 40_000;
const OVERSIZED_BYTES = 64 * 1024;
const HALF_DUPLEX = { duplex: "half" };
const VALID_SUBMISSION = {
  token: SETUP_TOKEN,
  name: "Ada",
  email: "ada@example.com",
  password: "correct-horse-battery",
};

function submitSetup(body: unknown) {
  return POST(
    new Request("http://localhost/api/setup", { method: "POST", body: JSON.stringify(body) }),
  );
}

describe("POST /api/setup", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("without a usable SETUP_TOKEN", () => {
    it.each([
      ["unset", ""],
      ["too short", "short"],
      ["low variety", "a".repeat(64)],
    ])("responds 503 and creates nothing when it is %s", async (_case, token) => {
      vi.stubEnv("SETUP_TOKEN", token);

      const response = await submitSetup(VALID_SUBMISSION);

      expect(response.status).toBe(503);
      expect(await database.select().from(user)).toEqual([]);
    });
  });

  describe("with SETUP_TOKEN configured", () => {
    beforeEach(() => {
      vi.stubEnv("SETUP_TOKEN", SETUP_TOKEN);
    });

    it("responds 401 and creates nothing with a wrong token", async () => {
      const response = await submitSetup({ ...VALID_SUBMISSION, token: "wrong" });

      expect(response.status).toBe(401);
      expect(await database.select().from(user)).toEqual([]);
    });

    it("responds 401 to a malformed body", async () => {
      const response = await POST(
        new Request("http://localhost/api/setup", { method: "POST", body: "{" }),
      );

      expect(response.status).toBe(401);
    });

    describe("with an oversized body", () => {
      it("responds 413 when Content-Length declares it", async () => {
        const response = await POST(
          new Request("http://localhost/api/setup", {
            method: "POST",
            headers: { "content-length": String(OVERSIZED_BYTES) },
            body: "{}",
          }),
        );

        expect(response.status).toBe(413);
      });

      it("responds 413 to a stream without Content-Length", async () => {
        const body = new ReadableStream({
          pull: (controller) => controller.enqueue(new Uint8Array(OVERSIZED_BYTES)),
        });

        const response = await POST(
          new Request("http://localhost/api/setup", { method: "POST", body, ...HALF_DUPLEX }),
        );

        expect(response.status).toBe(413);
      });
    });

    describe("after too many failed attempts", () => {
      async function failAttempts(count: number) {
        const statuses = [];
        for (let attempt = 0; attempt < count; attempt += 1) {
          const response = await submitSetup({ ...VALID_SUBMISSION, token: "wrong" });
          statuses.push(response.status);
        }
        return statuses;
      }

      afterEach(() => {
        vi.useRealTimers();
      });

      it("responds 429 to a wrong token", async () => {
        const statuses = await failAttempts(FAILED_ATTEMPTS_PER_WINDOW + 1);

        expect(statuses.at(FAILED_ATTEMPTS_PER_WINDOW - 1)).toBe(401);
        expect(statuses.at(-1)).toBe(429);
      });

      it("still lets the right token through", async () => {
        await failAttempts(FAILED_ATTEMPTS_PER_WINDOW + 1);

        expect((await submitSetup(VALID_SUBMISSION)).status).toBe(201);
      });

      it("does not count right tokens with invalid fields as failures", async () => {
        for (let attempt = 0; attempt <= FAILED_ATTEMPTS_PER_WINDOW; attempt += 1) {
          const response = await submitSetup({ ...VALID_SUBMISSION, password: "short" });
          expect(response.status).toBe(422);
        }

        expect(await database.select().from(rateLimit)).toEqual([]);
      });

      it("expires the window even while an attacker keeps trying", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(WINDOW_START);
        await failAttempts(FAILED_ATTEMPTS_PER_WINDOW + 1);

        vi.setSystemTime(WINDOW_START + ATTACKER_INTERVAL_MS);
        const duringWindow = await failAttempts(1);
        vi.setSystemTime(WINDOW_START + 2 * ATTACKER_INTERVAL_MS);
        const afterWindow = await failAttempts(1);

        expect(duringWindow).toEqual([429]);
        expect(afterWindow).toEqual([401]);
      });
    });

    it("responds 422 to an invalid password and keeps setup open", async () => {
      const response = await submitSetup({ ...VALID_SUBMISSION, password: "short" });

      expect(response.status).toBe(422);
      expect((await submitSetup(VALID_SUBMISSION)).status).toBe(201);
    });

    it("creates the admin once and refuses a second claim", async () => {
      const first = await submitSetup(VALID_SUBMISSION);
      const second = await submitSetup({ ...VALID_SUBMISSION, email: "second@example.com" });

      expect(first.status).toBe(201);
      expect(second.status).toBe(409);
      expect(await database.select().from(user)).toHaveLength(1);
    });

    it("lets one of two simultaneous requests succeed", async () => {
      const responses = await Promise.all([
        submitSetup(VALID_SUBMISSION),
        submitSetup({ ...VALID_SUBMISSION, email: "second@example.com" }),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    });
  });
});
