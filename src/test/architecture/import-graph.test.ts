import { describe, expect, it } from "vitest";

import { findComputedImports, findSelfImports, resolveSpecifier } from "./import-graph";

const IMPORTER = "src/test/architecture/import-graph.test.ts";

describe("resolving an import", () => {
  it("normalises .. in an aliased path, so it can't hide a reach into a module", () => {
    expect(resolveSpecifier(IMPORTER, "@/modules/feed/../intros/copy")).toBe("src/modules/intros/copy.ts");
  });

  it("finds a folder's index file", () => {
    expect(resolveSpecifier(IMPORTER, "./fixtures/folder")).toBe("src/test/architecture/fixtures/folder/index.ts");
  });

  it("finds a JavaScript file", () => {
    expect(resolveSpecifier(IMPORTER, "./fixtures/compiled")).toBe("src/test/architecture/fixtures/compiled.js");
  });

  it("finds a TypeScript file through its compiled name", () => {
    expect(resolveSpecifier(IMPORTER, "./fixtures/typed.js")).toBe("src/test/architecture/fixtures/typed.ts");
  });

  it("reports nothing for a path that doesn't exist", () => {
    expect(resolveSpecifier(IMPORTER, "./fixtures/missing")).toBeNull();
  });

  it("leaves a package alone", () => {
    expect(resolveSpecifier(IMPORTER, "zod")).toBeNull();
  });
});

describe("finding imports the graph can't follow", () => {
  it("spots a computed import", () => {
    expect(findComputedImports("file.ts", "const moduleName = 'x'; await import(moduleName);")).toEqual(["import(moduleName)"]);
  });

  it("spots a computed template import", () => {
    expect(findComputedImports("file.ts", "await import(`./${name}`);")).toHaveLength(1);
  });

  it("accepts a literal import", () => {
    expect(findComputedImports("file.ts", 'await import("./literal");')).toEqual([]);
  });

  it("spots a file that imports itself", () => {
    expect(findSelfImports([{ from: "a.ts", to: "a.ts" }, { from: "a.ts", to: "b.ts" }])).toEqual(["a.ts"]);
  });
});
