import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { MODULES } from "@/modules/registry";
import { saveModuleState } from "@/platform/modules/enablement";
import { MODULE_KINDS, type ToggleableManifest } from "@/platform/modules/manifest";
import { clearDatabase, createTestDatabase } from "@/test/database";

import { proxy } from "./proxy";

const APP_URL = "http://localhost:3000";
const REWRITE_HEADER = "x-middleware-rewrite";

const toggleable = MODULES.map(({ manifest }) => manifest).filter((manifest): manifest is ToggleableManifest => manifest.kind === MODULE_KINDS.toggleable);

function rewriteOf(path: string) {
  return proxy(new NextRequest(`${APP_URL}${path}`)).then((response) => response.headers.get(REWRITE_HEADER));
}

describe("a page of a switched-off module, before it renders", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$client.end();
  });

  describe.each(toggleable.map((manifest) => ({ id: manifest.id, manifest })))("$id", ({ manifest }) => {
    const pages = manifest.paths.pages.filter((page) => page !== "/");

    it("goes to the not-found page when off", async () => {
      await saveModuleState(database, manifest, false);
      for (const page of pages) expect(await rewriteOf(page), page).toContain("/_module-off");
    });

    it("renders as usual when on", async () => {
      await saveModuleState(database, manifest, true);
      for (const page of pages) expect(await rewriteOf(page), page).toBeNull();
    });
  });

  it("leaves core pages alone", async () => {
    for (const manifest of toggleable) await saveModuleState(database, manifest, false);
    expect(await rewriteOf("/members")).toBeNull();
    expect(await rewriteOf("/")).toBeNull();
  });
});
