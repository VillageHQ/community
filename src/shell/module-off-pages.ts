import "server-only";

import { MODULES } from "@/modules/registry";
import type { Database } from "@/platform/database/client";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { MODULE_KINDS } from "@/platform/modules/manifest";

const TOGGLEABLE = MODULES.map(({ manifest }) => manifest).filter(({ kind }) => kind !== MODULE_KINDS.core);

function isUnder(pathname: string, ownedPath: string) {
  return pathname === ownedPath || pathname.startsWith(`${ownedPath}/`);
}

// The page of a module the admin turned off. The longest owned path wins, as with routes.
export function findPageOwner(pathname: string) {
  const claims = TOGGLEABLE.flatMap((manifest) => manifest.paths.pages.filter((ownedPath) => ownedPath !== "/" && isUnder(pathname, ownedPath)).map((ownedPath) => ({ manifest, ownedPath })));
  return claims.toSorted((first, second) => second.ownedPath.length - first.ownedPath.length)[0]?.manifest ?? null;
}

export async function isModulePageOff(database: Database, pathname: string) {
  const owner = findPageOwner(pathname);
  return owner !== null && !(await isModuleEnabled(database, owner));
}
