import { randomUUID } from "node:crypto";

import { count, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import migrationJournal from "../../../drizzle/meta/_journal.json";
import { createDisposableDatabase } from "@/test/database";
import { createDatabase } from "./client";
import { instanceSettings } from "@/platform/settings/schema";
import { areMigrationsApplied } from "./migrations-status";
import { runMigrations } from "./run-migrations";

const CONCURRENT_RUNS = 6;

describe("runMigrations", () => {
  let disposable: Awaited<ReturnType<typeof createDisposableDatabase>>;
  let database: ReturnType<typeof createDatabase>;

  async function countRecordedMigrations() {
    const { rows } = await database.execute(
      sql`select count(*)::int as total from public.__drizzle_migrations`,
    );
    return rows[0]?.total;
  }

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
    it("reports migrations as missing before it runs", async () => {
      expect(await areMigrationsApplied(database)).toBe(false);
    });

    it("creates the schema and reports migrations as applied", async () => {
      await runMigrations(disposable.connectionString, {});

      const [settings] = await database.select({ total: count() }).from(instanceSettings);
      expect(settings?.total).toBe(0);
      expect(await areMigrationsApplied(database)).toBe(true);
    });
  });

  describe("when run twice", () => {
    it("records each migration once and skips the second run", async () => {
      const first = await runMigrations(disposable.connectionString, {});
      const second = await runMigrations(disposable.connectionString, {});

      expect(first).toEqual({ migrated: true });
      expect(second).toEqual({ migrated: false });
      expect(await countRecordedMigrations()).toBe(migrationJournal.entries.length);
    });
  });

  describe("when instances start concurrently", () => {
    it("all succeed and record each migration once", async () => {
      await Promise.all(
        Array.from({ length: CONCURRENT_RUNS }, () =>
          runMigrations(disposable.connectionString, {}),
        ),
      );

      expect(await countRecordedMigrations()).toBe(migrationJournal.entries.length);
    });
  });

  describe("when the connection dies while waiting for the lock", () => {
    it("rejects with the cause instead of crashing", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const lockHolder = createDatabase(disposable.connectionString, {});
      const lockClient = await lockHolder.$client.connect();
      await lockClient.query("select pg_advisory_lock(7260411)");

      const migration = runMigrations(disposable.connectionString, {});
      await vi.waitFor(
        async () => {
          const { rows } = await lockClient.query(
            "select pg_terminate_backend(pid) from pg_stat_activity where wait_event_type = 'Lock' and pid <> pg_backend_pid()",
          );
          expect(rows).toHaveLength(1);
        },
        { timeout: 30_000, interval: 50 },
      );

      await expect(migration).rejects.toThrow();

      lockClient.release();
      await lockHolder.$client.end();
    });
  });

  describe("with a role that cannot create schemas", () => {
    it("still migrates when it holds rights on the public schema", async () => {
      const role = `restricted_${randomUUID().replaceAll("-", "")}`;
      const password = randomUUID();
      await database.execute(
        sql`create role ${sql.identifier(role)} login password ${sql.raw(`'${password}'`)}`,
      );
      await database.execute(sql`revoke create on schema public from public`);
      await database.execute(sql`grant usage, create on schema public to ${sql.identifier(role)}`);

      const url = new URL(disposable.connectionString);
      url.username = role;
      url.password = password;

      try {
        await runMigrations(url.toString(), {});
        expect(await areMigrationsApplied(database)).toBe(true);
      } finally {
        await database.execute(sql`drop owned by ${sql.identifier(role)} cascade`);
        await database.execute(sql`drop role ${sql.identifier(role)}`);
      }
    });
  });
});
