import "server-only";

import type { Database, DatabaseOrTransaction } from "../database/client.ts";
import { readSettings, saveSettings } from "../settings/store.ts";
import { MODULE_KINDS, type ModuleManifest, type ToggleableManifest } from "./manifest.ts";

const MODULE_STATES = { on: "on", off: "off" } as const;

function toSettingKey({ id }: ModuleManifest) {
  return `module_state:${id}`;
}

function collectRequirements(manifest: ModuleManifest): ModuleManifest[] {
  return [manifest, ...manifest.requires.flatMap(collectRequirements)];
}

function isStoredOn(manifest: ModuleManifest, stored: ReadonlyMap<string, string>) {
  if (manifest.kind === MODULE_KINDS.core) return true;
  const state = stored.get(toSettingKey(manifest));
  return state ? state === MODULE_STATES.on : manifest.isOnByDefault;
}

export async function readStoredModuleStates(database: Database, manifests: readonly ModuleManifest[]) {
  const stored = await readSettings(database, manifests.filter(({ kind }) => kind === MODULE_KINDS.toggleable).map(toSettingKey));
  return new Map(manifests.map((manifest) => [manifest.id, isStoredOn(manifest, stored)]));
}

export async function readEnabledModuleIds(database: Database, manifests: readonly ModuleManifest[]) {
  const toggleable = manifests.flatMap(collectRequirements).filter(({ kind }) => kind === MODULE_KINDS.toggleable);
  const stored = toggleable.length > 0 ? await readSettings(database, toggleable.map(toSettingKey)) : new Map<string, string>();
  const enabled = manifests.filter((manifest) => collectRequirements(manifest).every((required) => isStoredOn(required, stored)));
  return new Set(enabled.map(({ id }) => id));
}

export async function isModuleEnabled(database: Database, manifest: ModuleManifest) {
  return (await readEnabledModuleIds(database, [manifest])).has(manifest.id);
}

export async function saveModuleState(connection: DatabaseOrTransaction, manifest: ToggleableManifest, isOn: boolean) {
  await saveSettings(connection, { [toSettingKey(manifest)]: isOn ? MODULE_STATES.on : MODULE_STATES.off });
}
