import "server-only";

import { createMemberRoutes } from "../http/member-route.ts";
import { respondToVillageError } from "./route-errors.ts";

export const { createMemberRoute, createAdminBinaryRoute, createMemberBinaryRoute } = createMemberRoutes([respondToVillageError]);
