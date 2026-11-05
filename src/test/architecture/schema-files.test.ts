import { readFileSync } from "node:fs";
import { matchesGlob, resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { isTestFile, readSourceFiles, REPOSITORY_ROOT } from "./import-graph";
import { isEdgeAllowed } from "./layers";
import { readDeclaredTables, readLoadedSchemaFiles, readSchemaPatterns } from "./schema-files";

const MIGRATION_LEDGER_FILE = "src/platform/database/migrations-status.ts";
const SNAPSHOT_TABLE_PREFIX = "public.";

const journalSchema = z.object({ entries: z.array(z.object({ idx: z.number() })) });
const snapshotSchema = z.object({ tables: z.record(z.string(), z.unknown()) });

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(REPOSITORY_ROOT, path), "utf8"));
}

function readLatestSnapshotTables() {
  const { entries } = journalSchema.parse(readJson("drizzle/meta/_journal.json"));
  const latestIndex = Math.max(...entries.map(({ idx }) => idx));
  const snapshotName = `${String(latestIndex).padStart(4, "0")}_snapshot.json`;
  const { tables } = snapshotSchema.parse(readJson(`drizzle/meta/${snapshotName}`));
  return Object.keys(tables).map((key) => key.replace(SNAPSHOT_TABLE_PREFIX, ""));
}

// A table drizzle-kit can't see is a table it drops in the next generated migration.
describe("the schema files", () => {
  it("are all loaded by drizzle.config.ts", () => {
    const declaring = readSourceFiles().filter((file) => !isTestFile(file) && file !== MIGRATION_LEDGER_FILE && readDeclaredTables(file).length > 0);

    expect(declaring.filter((file) => !readLoadedSchemaFiles().includes(file))).toEqual([]);
  });

  it("declare every table the migrations created", () => {
    const declared = new Set(readLoadedSchemaFiles().flatMap(readDeclaredTables));

    expect(readLatestSnapshotTables().filter((table) => !declared.has(table))).toEqual([]);
  });

  it.each(["src/modules/feed/schema.ts", "src/modules/feed/schema-topic.ts"])("load %s, a name the layer rules approve", (file) => {
    expect(isEdgeAllowed("src/modules/admin/reads.ts", file)).toBe(true);
    expect(readSchemaPatterns().some((pattern) => matchesGlob(file, pattern.replace("./", "")))).toBe(true);
  });
});
