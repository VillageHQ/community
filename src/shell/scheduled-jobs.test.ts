import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MODULES } from "@/modules/registry";
import { provideWeeklyAllowance } from "@/platform/allowance/weekly-allowance";
import { runJob, JOB_OUTCOMES } from "@/platform/jobs/runner";
import { saveModuleState } from "@/platform/modules/enablement";
import { MODULE_KINDS, type ToggleableManifest } from "@/platform/modules/manifest";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { watchQueryOverlap } from "@/test/query-overlap";

import { readAskAllowance } from "./ask-helpers";
import { DEMO_RESET_JOB_NAME, startDemo } from "./demo-reset";
import { readScheduledJobs } from "./scheduled-jobs";

// The Fly host test (2026-11-12) logged pg's "already executing a query" warning on the first tick: the intro-expiry
// job read the weekly allowance inside its transaction with three queries at once.
const DEMO_ENVIRONMENT = { DEMO_MODE: "true", APP_URL: "http://localhost:3000" };

describe("timed jobs", () => {
  const database = createTestDatabase();
  let watch: ReturnType<typeof watchQueryOverlap> | undefined;

  beforeEach(async () => {
    await clearDatabase(database);
    await database.execute(sql`truncate table "user" cascade`);
  });

  afterEach(() => {
    watch?.stop();
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await database.$client.end();
  });

  it("never send two queries at once on one connection", async () => {
    for (const [key, value] of Object.entries(DEMO_ENVIRONMENT)) vi.stubEnv(key, value);
    // As the app's boot does (src/instrumentation.ts): intro emails say how many asks are left.
    provideWeeklyAllowance(readAskAllowance);
    await startDemo(database, DEMO_ENVIRONMENT);
    const toggleable = MODULES.map(({ manifest }) => manifest).filter((manifest): manifest is ToggleableManifest => manifest.kind === MODULE_KINDS.toggleable);
    for (const manifest of toggleable) await saveModuleState(database, manifest, true);

    watch = watchQueryOverlap();
    const outcomes: Record<string, string> = {};
    for (const job of await readScheduledJobs(database)) {
      if (job.name === DEMO_RESET_JOB_NAME) continue;
      outcomes[job.name] = await runJob(database, DEMO_ENVIRONMENT, job);
    }

    expect(Object.values(outcomes).every((outcome) => outcome === JOB_OUTCOMES.ran), JSON.stringify(outcomes)).toBe(true);
    expect(outcomes["intro-expiry"]).toBe(JOB_OUTCOMES.ran);
    expect(watch.overlaps).toEqual([]);
  });

  it("read the weekly allowance one query at a time inside a transaction", async () => {
    await startDemo(database, DEMO_ENVIRONMENT);
    const [member] = await database.execute<{ id: string }>(sql`select id from "user" limit 1`).then(({ rows }) => rows);
    if (!member) throw new Error("the demo seeded no member");

    watch = watchQueryOverlap();
    const allowance = await database.transaction((transaction) => readAskAllowance(transaction, member.id));

    expect(allowance.cap).toBeGreaterThan(0);
    expect(watch.overlaps).toEqual([]);
  });
});
