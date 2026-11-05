import type { Environment } from "../environment.ts";

const DEFAULT_VILLAGE_API_URL = "https://api.village.do";
const DEFAULT_VILLAGE_SDK_URL = "https://js.village.do";

export function resolveVillageApiUrl(environment: Environment) {
  return environment.VILLAGE_API_URL ?? DEFAULT_VILLAGE_API_URL;
}

export function resolveVillageSdkUrl(environment: Environment) {
  return environment.VILLAGE_SDK_URL ?? DEFAULT_VILLAGE_SDK_URL;
}
