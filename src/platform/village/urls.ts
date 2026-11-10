import { DEMO_VILLAGE_API_URL, isDemoMode } from "../demo/mode.ts";
import type { Environment } from "../environment.ts";

const DEFAULT_VILLAGE_APP_URL = "https://village.ai";

// Demo mode always calls the canned demo address, whatever VILLAGE_API_URL says.
export function resolveVillageApiUrl(environment: Environment) {
  if (isDemoMode(environment)) return DEMO_VILLAGE_API_URL;
  return environment.VILLAGE_API_URL;
}

// TODO(@villagehq/sdk): openSyncModal needs appUrl, and the SDK doesn't export the default it uses everywhere else.
export function resolveVillageAppUrl(environment: Environment) {
  return environment.VILLAGE_APP_URL ?? DEFAULT_VILLAGE_APP_URL;
}
