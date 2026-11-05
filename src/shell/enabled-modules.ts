import "server-only";

import { MODULES } from "@/modules/registry";
import type { Database } from "@/platform/database/client";
import { readEnabledModuleIds } from "@/platform/modules/enablement";
import type { NavigationBadgeCounts } from "./navigation-rules";

const MANIFESTS = MODULES.map(({ manifest }) => manifest);

export function readEnabledIds(database: Database) {
  return readEnabledModuleIds(database, MANIFESTS);
}

export function readRunsOnVillage(enabledIds: ReadonlySet<string>) {
  return MANIFESTS.some(({ id, needsVillage }) => needsVillage && enabledIds.has(id));
}

export async function readModuleBadges(database: Database, memberId: string, enabledIds: ReadonlySet<string>): Promise<NavigationBadgeCounts> {
  const reads = MODULES.flatMap(({ manifest, readNavigationBadge }) => {
    if (!readNavigationBadge || !enabledIds.has(manifest.id)) return [];
    return [readNavigationBadge(database, memberId).then((count) => [manifest.id, count] as const)];
  });
  return Object.fromEntries(await Promise.all(reads));
}
