import "server-only";

import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getDatabase } from "../database/client.ts";
import { isModuleEnabled } from "./enablement.ts";
import { MODULE_KINDS, type ModuleManifest } from "./manifest.ts";
import { recordPageOwner } from "./route-facts.ts";

// A layout can't guard its pages: it doesn't re-render on navigation and doesn't stop child segments. So each page guards itself.
export function modulePage<Arguments extends unknown[]>(owner: ModuleManifest, render: (...pageArguments: Arguments) => Promise<ReactNode>) {
  const Page = async (...pageArguments: Arguments) => {
    if (owner.kind !== MODULE_KINDS.core && !(await isModuleEnabled(getDatabase(), owner))) notFound();
    return render(...pageArguments);
  };
  recordPageOwner(Page, owner.id);
  return Page;
}
