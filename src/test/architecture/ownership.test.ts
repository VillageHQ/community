import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { MODULES } from "@/modules/registry";
import { MODULE_KINDS, type ModuleManifest } from "@/platform/modules/manifest";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { readPageOwner, readRouteFacts, ROUTE_ACCESS } from "@/platform/modules/route-facts";

import { findOwnerId, readGuardedLayoutFiles, readPageFiles, readRouteFiles, toUrlPath } from "./app-files";
import { isTestFile, readImportEdges, readSourceFiles, REPOSITORY_ROOT } from "./import-graph";
import { readModuleName } from "./layers";

const HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]);
const ADMIN_API_PREFIX = "/api/admin/";
const MODULE_ON_TOP = "admin";
const ROUTES_THAT_STAY_OPEN = ["/api/network/leave"];
const MODULES_DIRECTORY = resolve(REPOSITORY_ROOT, "src/modules");

const manifests = MODULES.map(({ manifest }) => manifest);
const owners = [PLATFORM_MANIFEST, ...manifests];

function loadFile(file: string) {
  return import(/* @vite-ignore */ resolve(REPOSITORY_ROOT, file));
}

async function readHandlers(file: string) {
  return Object.entries(await loadFile(file)).flatMap(([name, handler]) => {
    if (!HTTP_METHODS.has(name) || typeof handler !== "function") return [];
    return [{ name, handler }];
  });
}

function collectRequirements(manifest: ModuleManifest): ModuleManifest[] {
  return [manifest, ...manifest.requires.flatMap(collectRequirements)];
}

describe("every API route", () => {
  it.each(readRouteFiles())("%s is wrapped and declares its owner", async (file) => {
    const handlers = await readHandlers(file);
    const ownerId = findOwnerId(toUrlPath(file), owners, "api");

    expect(handlers.length).toBeGreaterThan(0);
    for (const { handler } of handlers) expect(readRouteFacts(handler)?.ownerId ?? null).toBe(ownerId);
    expect(ownerId).not.toBeNull();
  });

  it.each(readRouteFiles().filter((file) => toUrlPath(file).startsWith(ADMIN_API_PREFIX)))("%s requires an admin", async (file) => {
    for (const { handler } of await readHandlers(file)) expect(readRouteFacts(handler)?.access).toBe(ROUTE_ACCESS.admin);
  });
});

describe("a route that stays open when its module is off", () => {
  it("is only the one that lets a member leave Village", async () => {
    const flagged = await Promise.all(
      readRouteFiles().map(async (file) => {
        const handlers = await readHandlers(file);
        return handlers.some(({ handler }) => readRouteFacts(handler)?.staysOpenWhenOff) ? [toUrlPath(file)] : [];
      }),
    );

    expect(flagged.flat()).toEqual(ROUTES_THAT_STAY_OPEN);
  });
});

describe("every page", () => {
  it.each(readPageFiles())("%s declares its owner", async (file) => {
    const { default: page } = await loadFile(file);
    const ownerId = findOwnerId(toUrlPath(file), owners, "pages");

    expect(ownerId).not.toBeNull();
    expect(readPageOwner(page)).toBe(ownerId);
  });

  it.each(readGuardedLayoutFiles())("%s declares its owner", async (file) => {
    const { default: layout } = await loadFile(file);

    expect(readPageOwner(layout)).toBe(findOwnerId(toUrlPath(file), owners, "pages"));
  });
});

describe("the registry", () => {
  it("lists every module folder once", () => {
    const folders = readdirSync(MODULES_DIRECTORY, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map(({ name }) => name);

    expect(manifests.map(({ id }) => id).toSorted()).toEqual(folders.toSorted());
  });

  it("declares every import of a toggleable module", () => {
    const toggleableIds = new Set(manifests.filter(({ kind }) => kind === MODULE_KINDS.toggleable).map(({ id }) => id));
    const productionFiles = readSourceFiles().filter((file) => !isTestFile(file));
    const undeclared = readImportEdges(productionFiles).flatMap(({ from, to }) => {
      const importer = readModuleName(from);
      const imported = readModuleName(to);
      if (!importer || !imported || importer === imported || importer === MODULE_ON_TOP || !toggleableIds.has(imported)) return [];
      const manifest = manifests.find(({ id }) => id === importer);
      const required = manifest ? collectRequirements(manifest).map(({ id }) => id) : [];
      return required.includes(imported) ? [] : [`${from} -> ${to}`];
    });

    expect(undeclared).toEqual([]);
  });
});
