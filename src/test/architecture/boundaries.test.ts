import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  findCycles,
  findSelfImports,
  followImports,
  isTestFile,
  readComputedImports,
  readImportEdges,
  readImportSpecifiers,
  readSourceFiles,
  readUnresolvedImports,
  REPOSITORY_ROOT,
  type ImportEdge,
} from "./import-graph";
import { isEdgeAllowed, readModuleName } from "./layers";
import { readLoadedSchemaFiles } from "./schema-files";

const SERVER_ONLY_PACKAGE = "server-only";
const PATH_ALIAS_PREFIX = "@/";
const BOOT_ENTRY_FILE = "scripts/migrate.ts";
const MODULE_NOT_FOUND_CODE = "ERR_MODULE_NOT_FOUND";
const MIGRATION_SCRIPT_OUTPUT = "igrations";
const RELATIVE_SPECIFIER_PREFIX = ".";

const sourceFiles = readSourceFiles();
const productionFiles = sourceFiles.filter((file) => !isTestFile(file));
const productionEdges = readImportEdges(productionFiles);

function toModuleEdges(edges: readonly ImportEdge[]) {
  return edges.flatMap(({ from, to }) => {
    const importer = readModuleName(from);
    const imported = readModuleName(to);
    return importer && imported && importer !== imported ? [{ from: importer, to: imported }] : [];
  });
}

describe("the import graph", () => {
  it("keeps every import inside the layer rules", () => {
    const violations = productionEdges.filter(({ from, to }) => !isEdgeAllowed(from, to)).map(({ from, to }) => `${from} -> ${to}`);

    expect([...new Set(violations)].toSorted()).toEqual([]);
  });

  it("resolves every local import", () => {
    expect(readUnresolvedImports(productionFiles)).toEqual([]);
  });

  it("has no file that imports itself", () => {
    expect(findSelfImports(productionEdges)).toEqual([]);
  });

  it("has no computed import, because the graph can't follow one", () => {
    expect(readComputedImports(productionFiles)).toEqual([]);
  });

  it("has no file cycles", () => {
    expect(findCycles(productionEdges)).toEqual([]);
  });

  it("has no cycles between modules", () => {
    expect(findCycles(toModuleEdges(productionEdges))).toEqual([]);
  });
});

describe("the code that runs outside Next", () => {
  const bootFiles = followImports([BOOT_ENTRY_FILE, ...readLoadedSchemaFiles()]);

  it.each(bootFiles)("loads %s without server-only or the path alias", (file) => {
    const blocked = readImportSpecifiers(file).filter((specifier) => specifier === SERVER_ONLY_PACKAGE || specifier.startsWith(PATH_ALIAS_PREFIX));

    expect(blocked).toEqual([]);
  });

  it.each(bootFiles)("names the exact file in every relative import of %s, as Node requires", (file) => {
    const inexact = readImportSpecifiers(file).filter(
      (specifier) => specifier.startsWith(RELATIVE_SPECIFIER_PREFIX) && !existsSync(resolve(REPOSITORY_ROOT, dirname(file), specifier)),
    );

    expect(inexact).toEqual([]);
  });

  it("starts the migration script under plain Node", () => {
    const { stdout, stderr } = spawnSync(process.execPath, [BOOT_ENTRY_FILE], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "", DATABASE_URL_UNPOOLED: "" },
    });

    expect(stderr).not.toContain(MODULE_NOT_FOUND_CODE);
    expect(`${stdout}${stderr}`).toContain(MIGRATION_SCRIPT_OUTPUT);
  });
});

describe("the modules", () => {
  const modulesDirectory = resolve(REPOSITORY_ROOT, "src/modules");
  const moduleNames = readdirSync(modulesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name);

  it.each(moduleNames)("%s keeps notes for contributors", (moduleName) => {
    expect(existsSync(resolve(modulesDirectory, moduleName, "AGENTS.md"))).toBe(true);
  });
});
