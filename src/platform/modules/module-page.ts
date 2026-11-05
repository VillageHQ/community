import "server-only";

import type { ReactNode } from "react";

import type { ModuleManifest } from "./manifest.ts";
import { recordPageOwner } from "./route-facts.ts";

export function modulePage<Arguments extends unknown[]>(owner: ModuleManifest, render: (...pageArguments: Arguments) => Promise<ReactNode>) {
  const Page = async (...pageArguments: Arguments) => render(...pageArguments);
  recordPageOwner(Page, owner.id);
  return Page;
}
