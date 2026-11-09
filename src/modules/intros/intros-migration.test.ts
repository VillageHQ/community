import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { user } from "@/platform/database/auth-schema";
import { INTRO_STATES, isOpenIntroState, readRequesterState } from "@/modules/intros/contract";
import { createDisposableDatabase } from "@/test/database";

import { introRequest } from "./schema";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../..");
const MIGRATIONS_FOLDER = join(REPOSITORY_ROOT, "drizzle");
const LAST_MIGRATION_BEFORE_DOUBLE_OPT_IN = "0013_asks";
const OLD_STATES = ["requested", "accepted", "declined", "withdrawn", "completed", "expired"];
const MILLISECONDS_PER_DAY = 86_400_000;
const MIGRATION_HOOK_TIMEOUT_MS = 120_000;

const journalSchema = z.looseObject({ version: z.string(), dialect: z.string(), entries: z.array(z.looseObject({ tag: z.string() })) });

function writeMigrationsUpTo(lastTag: string) {
  const folder = mkdtempSync(join(tmpdir(), "intro-migrations-"));
  cpSync(MIGRATIONS_FOLDER, folder, { recursive: true });
  const journal = journalSchema.parse(JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8")));
  const lastIndex = journal.entries.findIndex(({ tag }) => tag === lastTag);
  writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify({ ...journal, entries: journal.entries.slice(0, lastIndex + 1) }));
  return folder;
}

describe("the double opt-in migration", () => {
  let disposable: Awaited<ReturnType<typeof createDisposableDatabase>>;
  let client: Client;
  let partialFolder: string;
  const requesterId = randomUUID();
  const introducerId = randomUUID();

  function database() {
    return drizzle({ client });
  }

  beforeAll(async () => {
    disposable = await createDisposableDatabase();
    client = new Client({ connectionString: disposable.connectionString });
    await client.connect();
    partialFolder = writeMigrationsUpTo(LAST_MIGRATION_BEFORE_DOUBLE_OPT_IN);
    await migrate(database(), { migrationsFolder: partialFolder });

    await database().insert(user).values([
      { id: requesterId, name: "Old Requester", email: `${requesterId}@old.test`, emailVerified: true },
      { id: introducerId, name: "Old Introducer", email: `${introducerId}@old.test`, emailVerified: true },
    ]);
    for (const state of OLD_STATES) {
      await database().execute(sql`
        insert into intro_request (requester_id, introducer_id, target_linkedin_slug, target_name, introducer_name, introducer_linkedin_slug, reason, note, state, expires_at, closed_at, accepted_at)
        values (${requesterId}, ${introducerId}, ${`target-${state}`}, 'Old Target', 'Old Introducer', 'old-introducer', 'A reason', ${`Note for ${state}`}, ${state}, ${new Date(Date.now() + MILLISECONDS_PER_DAY).toISOString()}, null, ${state === "accepted" ? new Date().toISOString() : null})
      `);
    }
    await migrate(database(), { migrationsFolder: MIGRATIONS_FOLDER });
  }, MIGRATION_HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await client.end();
    await disposable.destroy();
    rmSync(partialFolder, { recursive: true, force: true });
  }, MIGRATION_HOOK_TIMEOUT_MS);

  it("keeps every old row, with its state and note", async () => {
    const rows = await database().select().from(introRequest);

    expect(rows.map(({ state }) => state).toSorted()).toEqual(OLD_STATES.toSorted());
    for (const { state, note } of rows) expect(note).toBe(`Note for ${state}`);
  });

  it("starts every new column empty", async () => {
    const rows = await database().select().from(introRequest);

    for (const row of rows) {
      expect(row).toMatchObject({ targetEmail: null, outcomeEmailAt: null, outcomeReminderAt: null, askedTargetAt: null, targetAgreedAt: null, outcome: null, declineKind: null });
    }
  });

  it("keeps an in-flight accepted ask open and visible as before", async () => {
    const [accepted] = await database().select().from(introRequest).where(eq(introRequest.state, INTRO_STATES.accepted));

    expect(isOpenIntroState(INTRO_STATES.accepted)).toBe(true);
    expect(readRequesterState(accepted?.state ?? "")).toBe(INTRO_STATES.accepted);
    expect(accepted?.acceptedAt).not.toBeNull();
  });

  it("still refuses a second open ask, across old and new open states", async () => {
    const [requested] = await database().select().from(introRequest).where(eq(introRequest.state, INTRO_STATES.requested));
    const duplicate = {
      requesterId,
      introducerId,
      targetLinkedinSlug: requested?.targetLinkedinSlug ?? "",
      targetName: "Old Target",
      introducerName: "Old Introducer",
      introducerLinkedinSlug: "old-introducer",
      reason: "A reason",
      note: "Again",
      state: INTRO_STATES.askingTarget,
      expiresAt: new Date(),
    };

    await expect(database().insert(introRequest).values(duplicate)).rejects.toThrow();
  });

  describe("the database itself refuses", () => {
    it("an unknown state", async () => {
      await expect(database().update(introRequest).set({ state: "made_up" })).rejects.toThrow();
    });

    it("a target's address kept after the ask closed", async () => {
      await expect(database().update(introRequest).set({ targetEmail: "a@b.test" }).where(eq(introRequest.state, INTRO_STATES.declined))).rejects.toThrow();
    });

    it("an outcome on an intro that wasn't made", async () => {
      await expect(database().update(introRequest).set({ outcome: "helped" }).where(eq(introRequest.state, INTRO_STATES.declined))).rejects.toThrow();
    });
  });
});
