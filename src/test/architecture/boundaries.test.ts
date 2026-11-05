import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  followImports,
  findCycles,
  isTestFile,
  readImportEdges,
  readImportSpecifiers,
  readSourceFiles,
  REPOSITORY_ROOT,
  type ImportEdge,
} from "./import-graph";
import { isEdgeAllowed, readModuleName } from "./layers";

const SERVER_ONLY_PACKAGE = "server-only";
const PATH_ALIAS_PREFIX = "@/";
const BOOT_ENTRY_FILE = "scripts/migrate.ts";
const SCHEMA_FILE_PATTERN = /(^|\/|-)schema\.ts$/;

// Every entry is a debt. New violations fail, and so do entries that no longer exist, so this list only shrinks.
const KNOWN_VIOLATIONS: readonly string[] = [
  "src/components/shell/navigation-links.tsx -> src/modules/intros/queries.ts",
  "src/components/shell/navigation-links.tsx -> src/modules/messages/queries.ts",
  "src/components/shell/search-ready-notice.tsx -> src/modules/network/queries.ts",
];

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

    expect([...new Set(violations)].toSorted()).toEqual([...KNOWN_VIOLATIONS].toSorted());
  });

  it("has no file cycles", () => {
    expect(findCycles(productionEdges)).toEqual([]);
  });

  it("has no cycles between modules", () => {
    expect(findCycles(toModuleEdges(productionEdges))).toEqual([]);
  });
});

describe("the code that runs outside Next", () => {
  const schemaFiles = productionFiles.filter((file) => SCHEMA_FILE_PATTERN.test(file));
  const bootFiles = followImports([BOOT_ENTRY_FILE, ...schemaFiles]);

  it.each(bootFiles)("loads %s without server-only or the path alias", (file) => {
    const blocked = readImportSpecifiers(file).filter((specifier) => specifier === SERVER_ONLY_PACKAGE || specifier.startsWith(PATH_ALIAS_PREFIX));

    expect(blocked).toEqual([]);
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
