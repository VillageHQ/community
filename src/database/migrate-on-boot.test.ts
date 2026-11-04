import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDisposableDatabase } from "../test/database";
import { createDatabase } from "./client";
import { migrateOnBoot } from "./migrate-on-boot";
import { areMigrationsApplied } from "./migrations-status";

const FAST_RETRIES = { firstMs: 20, maximumMs: 100 };
const CONCURRENT_BOOTS = 6;

describe("migrateOnBoot", () => {
  let disposable: Awaited<ReturnType<typeof createDisposableDatabase>>;
  let database: ReturnType<typeof createDatabase>;

  beforeEach(async () => {
    disposable = await createDisposableDatabase();
    database = createDatabase(disposable.connectionString, {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await database.$client.end();
    await disposable.destroy();
  });

  describe("on an empty database", () => {
    it("applies migrations before it resolves", async () => {
      await migrateOnBoot({ DATABASE_URL: disposable.connectionString }, FAST_RETRIES);

      expect(await areMigrationsApplied(database)).toBe(true);
    });

    it("stays safe when instances boot concurrently", async () => {
      const boots = Array.from({ length: CONCURRENT_BOOTS }, () =>
        migrateOnBoot({ DATABASE_URL: disposable.connectionString }, FAST_RETRIES),
      );

      await expect(Promise.all(boots)).resolves.toBeDefined();
      expect(await areMigrationsApplied(database)).toBe(true);
    });
  });

  describe("on a Vercel preview", () => {
    it("skips migrations by default", async () => {
      vi.spyOn(console, "log").mockImplementation(() => undefined);

      await migrateOnBoot({ VERCEL_ENV: "preview", DATABASE_URL: disposable.connectionString });

      expect(await areMigrationsApplied(database)).toBe(false);
    });

    it("migrates when explicitly enabled", async () => {
      await migrateOnBoot(
        {
          VERCEL_ENV: "preview",
          MIGRATE_ON_PREVIEW: "true",
          DATABASE_URL: disposable.connectionString,
        },
        FAST_RETRIES,
      );

      expect(await areMigrationsApplied(database)).toBe(true);
    });
  });

  describe("without a database URL", () => {
    it("logs the cause and resolves", async () => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

      await expect(migrateOnBoot({})).resolves.toBeUndefined();

      expect(JSON.stringify(logged.mock.calls)).toContain("DATABASE_URL");
    });
  });

  describe("when the first attempt lacks permission", () => {
    it("resolves, logs the cause, and recovers once the grant arrives", async () => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const role = `boot_${randomUUID().replaceAll("-", "")}`;
      const password = randomUUID();
      await database.execute(
        sql`create role ${sql.identifier(role)} login password ${sql.raw(`'${password}'`)}`,
      );
      await database.execute(sql`revoke create on schema public from public`);
      const url = new URL(disposable.connectionString);
      url.username = role;
      url.password = password;

      await migrateOnBoot({ DATABASE_URL: url.toString() }, FAST_RETRIES);

      expect(await areMigrationsApplied(database)).toBe(false);
      expect(JSON.stringify(logged.mock.calls)).toContain("permission denied");

      await database.execute(sql`grant usage, create on schema public to ${sql.identifier(role)}`);
      await vi.waitFor(async () => expect(await areMigrationsApplied(database)).toBe(true), {
        timeout: 5_000,
        interval: 50,
      });

      await database.execute(sql`drop owned by ${sql.identifier(role)} cascade`);
      await database.execute(sql`drop role ${sql.identifier(role)}`);
    });
  });
});
