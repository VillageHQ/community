import { House, Waypoints } from "lucide-react";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { clearDatabase, createTestDatabase } from "../../test/database.ts";
import { isModuleEnabled, readEnabledModuleIds, saveModuleState } from "./enablement.ts";
import { MODULE_KINDS, type CoreManifest, type ToggleableManifest } from "./manifest.ts";

const FIELDS = { description: "", navigation: [], adminTabs: [], needsVillage: false, paths: { pages: [], api: [] } };

const CORE: CoreManifest = { ...FIELDS, kind: MODULE_KINDS.core, id: "core", label: "Core", icon: House, requires: [] };
const BASE: ToggleableManifest = { ...FIELDS, kind: MODULE_KINDS.toggleable, id: "base", label: "Base", icon: Waypoints, isOnByDefault: true, requires: [] };
const DEPENDENT: ToggleableManifest = { ...BASE, id: "dependent", label: "Dependent", requires: [BASE] };
const OFF_BY_DEFAULT: ToggleableManifest = { ...BASE, id: "later", label: "Later", isOnByDefault: false };

describe("module state", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$client.end();
  });

  it("follows each manifest's default when nothing is stored", async () => {
    const enabled = await readEnabledModuleIds(database, [CORE, BASE, DEPENDENT, OFF_BY_DEFAULT]);

    expect([...enabled].toSorted()).toEqual(["base", "core", "dependent"]);
  });

  it("turns a module off and back on", async () => {
    await saveModuleState(database, BASE, false);
    expect(await isModuleEnabled(database, BASE)).toBe(false);

    await saveModuleState(database, BASE, true);
    expect(await isModuleEnabled(database, BASE)).toBe(true);
  });

  it("turns on a module whose default is off", async () => {
    await saveModuleState(database, OFF_BY_DEFAULT, true);

    expect(await isModuleEnabled(database, OFF_BY_DEFAULT)).toBe(true);
  });

  describe("with a dependency", () => {
    it("pauses the dependent while the dependency is off", async () => {
      await saveModuleState(database, BASE, false);

      expect(await isModuleEnabled(database, DEPENDENT)).toBe(false);
    });

    it("restores the dependent when the dependency comes back", async () => {
      await saveModuleState(database, BASE, false);
      await saveModuleState(database, BASE, true);

      expect(await isModuleEnabled(database, DEPENDENT)).toBe(true);
    });

    it("keeps a dependent the admin turned off, off", async () => {
      await saveModuleState(database, DEPENDENT, false);
      await saveModuleState(database, BASE, false);
      await saveModuleState(database, BASE, true);

      expect(await isModuleEnabled(database, DEPENDENT)).toBe(false);
    });
  });

  it("never turns a core module off", async () => {
    expect(await isModuleEnabled(database, CORE)).toBe(true);
  });
});
