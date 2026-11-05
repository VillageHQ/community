import "server-only";

import { createElement } from "react";

import { MODULE_ERROR_CODES, type ModuleStateBody } from "@/modules/admin/contract-modules";
import { MODULES } from "@/modules/registry";
import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { withAdminTransaction } from "@/platform/audit/admin-transaction";
import { recordAdminAction } from "@/platform/audit/record";
import type { Database } from "@/platform/database/client";
import type { RequestContext } from "@/platform/http/request-context";
import { RequestError } from "@/platform/http/request-error";
import { readEnabledModuleIds, readStoredModuleStates, saveModuleState } from "@/platform/modules/enablement";
import { MODULE_KINDS, type ModuleManifest, type ToggleableManifest } from "@/platform/modules/manifest";

const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;

const MANIFESTS = MODULES.map(({ manifest }) => manifest);

function isToggleable(manifest: ModuleManifest): manifest is ToggleableManifest {
  return manifest.kind === MODULE_KINDS.toggleable;
}

function readToggleableManifest(moduleId: string) {
  const manifest = MANIFESTS.find(({ id }) => id === moduleId);
  if (!manifest) throw new RequestError(NOT_FOUND_STATUS, MODULE_ERROR_CODES.notFound, "We don't know that feature. Reload the page.");
  if (!isToggleable(manifest)) throw new RequestError(UNPROCESSABLE_STATUS, MODULE_ERROR_CODES.alwaysOn, `${manifest.label} is always on.`);
  return manifest;
}

async function requireRequirementsOn(database: Database, manifest: ToggleableManifest) {
  const enabledIds = await readEnabledModuleIds(database, manifest.requires);
  const missing = manifest.requires.find(({ id }) => !enabledIds.has(id));
  if (!missing) return;
  throw new RequestError(CONFLICT_STATUS, MODULE_ERROR_CODES.requirementOff, `${manifest.label} needs ${missing.label}. Turn on ${missing.label} first.`);
}

export async function setModuleState({ database, member }: RequestContext, { moduleId, isOn }: ModuleStateBody) {
  const manifest = readToggleableManifest(moduleId);
  if (isOn) await requireRequirementsOn(database, manifest);

  await withAdminTransaction(database, member.id, async (transaction) => {
    await saveModuleState(transaction, manifest, isOn);
    await recordAdminAction(transaction, member.id, {
      action: isOn ? AUDIT_ACTIONS.moduleTurnedOn : AUDIT_ACTIONS.moduleTurnedOff,
      detail: manifest.label,
    });
  });
  return `${manifest.label} is ${isOn ? "on" : "off"}.`;
}

function toIcon({ icon }: ModuleManifest) {
  return createElement(icon, { "aria-hidden": true });
}

export async function readFeatureScreen(database: Database) {
  const [storedStates, enabledIds] = await Promise.all([readStoredModuleStates(database, MANIFESTS), readEnabledModuleIds(database, MANIFESTS)]);
  const features = MANIFESTS.filter(isToggleable).map((manifest) => ({
    id: manifest.id,
    label: manifest.label,
    description: manifest.description,
    icon: toIcon(manifest),
    needsVillage: manifest.needsVillage,
    turnOffNote: manifest.turnOffNote ?? null,
    isOn: storedStates.get(manifest.id) === true,
    missingRequirement: manifest.requires.find(({ id }) => !enabledIds.has(id)) ?? null,
    dependentLabels: MANIFESTS.filter((candidate) => candidate.requires.some(({ id }) => id === manifest.id) && enabledIds.has(candidate.id)).map(({ label }) => label),
  }));
  const coreModules = MANIFESTS.filter((manifest) => !isToggleable(manifest)).map((manifest) => ({
    id: manifest.id,
    label: manifest.label,
    description: manifest.description,
    icon: toIcon(manifest),
  }));
  return {
    features: features.map(({ missingRequirement, ...feature }) => ({
      ...feature,
      missingRequirement: missingRequirement && { id: missingRequirement.id, label: missingRequirement.label },
    })),
    coreModules,
  };
}
