import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";

import type { ModuleStateBody } from "./contract-modules";

export function setModuleStateRequest(body: ModuleStateBody) {
  return postRequest(API_ROUTES.moduleState, body, acknowledgedResponseSchema);
}
