import { API_ROUTES } from "../../platform/http/routes.ts";
import { postRequest } from "../../platform/http/post-request.ts";
import { blockStateSchema, type SetBlockBody } from "./contract-blocks.ts";

export function setBlockRequest(body: SetBlockBody) {
  return postRequest(API_ROUTES.messageBlock, body, blockStateSchema);
}
