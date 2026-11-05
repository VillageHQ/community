"use client";

import { createContext, use, useMemo, type ReactNode } from "react";

const EnabledModulesContext = createContext<ReadonlySet<string> | null>(null);

export function EnabledModulesProvider({ ids, children }: { ids: readonly string[]; children?: ReactNode }) {
  const enabled = useMemo(() => new Set(ids), [ids]);
  return <EnabledModulesContext.Provider value={enabled}>{children}</EnabledModulesContext.Provider>;
}

export function useIsModuleEnabled(id: string) {
  const enabled = use(EnabledModulesContext);
  return enabled === null || enabled.has(id);
}
