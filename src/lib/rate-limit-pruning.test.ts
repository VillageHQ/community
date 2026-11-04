import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rateLimit } from "../database/auth-schema";
import { clearDatabase, createTestDatabase } from "../test/database";

const NOW = Date.UTC(2026, 10, 4);
const ONE_HOUR_MS = 3_600_000;
const TWO_MINUTES_MS = 120_000;
const BATCH_SIZE = 500;

function createRow(key: string, lastRequest: number) {
  return { id: key, key, count: 1, lastRequest };
}

async function loadPruner() {
  vi.resetModules();
  const { pruneExpiredRateLimits } = await import("./rate-limit-pruning");
  return pruneExpiredRateLimits;
}

describe("pruneExpiredRateLimits", () => {
  const database = createTestDatabase();

  async function readKeys() {
    return database.select({ key: rateLimit.key }).from(rateLimit);
  }

  beforeEach(async () => {
    await clearDatabase(database);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await database.$client.end();
  });

  it("deletes expired rows and keeps fresh ones", async () => {
    const prune = await loadPruner();
    await database
      .insert(rateLimit)
      .values([createRow("expired", NOW - ONE_HOUR_MS), createRow("fresh", NOW)]);

    await prune(database);

    expect(await readKeys()).toEqual([{ key: "fresh" }]);
  });

  it("runs at most once per interval", async () => {
    const prune = await loadPruner();
    await prune(database);
    await database.insert(rateLimit).values(createRow("expired", NOW - ONE_HOUR_MS));

    await prune(database);
    expect(await readKeys()).toEqual([{ key: "expired" }]);

    vi.setSystemTime(NOW + TWO_MINUTES_MS);
    await prune(database);
    expect(await readKeys()).toEqual([]);
  });

  it("deletes a bounded batch per run", async () => {
    const prune = await loadPruner();
    const expiredRows = Array.from({ length: BATCH_SIZE + 1 }, (_, position) =>
      createRow(`expired-${position}`, NOW - ONE_HOUR_MS),
    );
    await database.insert(rateLimit).values(expiredRows);

    await prune(database);

    expect(await readKeys()).toHaveLength(1);
  });
});
