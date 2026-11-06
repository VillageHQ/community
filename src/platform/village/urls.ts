import type { Environment } from "../environment.ts";

const DEFAULT_VILLAGE_APP_URL = "https://village.ai";

export function resolveVillageApiUrl(environment: Environment) {
  return environment.VILLAGE_API_URL;
}

// TODO(@villagehq/sdk): openSyncModal needs appUrl, and the SDK doesn't export the default it uses everywhere else.
export function resolveVillageAppUrl(environment: Environment) {
  return environment.VILLAGE_APP_URL ?? DEFAULT_VILLAGE_APP_URL;
}
