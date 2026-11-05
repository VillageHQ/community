import "server-only";

import type { z } from "zod";

import { REQUEST_ERROR_CODES } from "../http/error-codes.ts";
import { createMemberRoutes, type BinaryResponder, type BinaryRouteOptions, type MemberRouteOptions } from "../http/member-route.ts";
import type { RequestContext } from "../http/request-context.ts";
import { withRouteLogging } from "../observability/route-logging.ts";
import { respondToVillageError } from "../village/route-errors.ts";
import { getDatabase } from "../database/client.ts";
import { isModuleEnabled } from "./enablement.ts";
import { MODULE_KINDS, type ModuleManifest } from "./manifest.ts";
import { recordRouteFacts, ROUTE_ACCESS, type RouteAccess } from "./route-facts.ts";

type ModuleRouteOptions = { staysOpenWhenOff?: boolean };

const { createMemberRoute, createAdminBinaryRoute, createMemberBinaryRoute } = createMemberRoutes([respondToVillageError]);

const NOT_FOUND_STATUS = 404;
const MODULE_OFF_MESSAGE = "An admin turned this off, so it isn't available right now.";

export function createModuleRoutes(owner: ModuleManifest) {
  function declare<Arguments extends unknown[]>(
    handler: (...handlerArguments: Arguments) => Promise<Response>,
    scope: string,
    access: RouteAccess,
    { staysOpenWhenOff = false }: ModuleRouteOptions,
  ) {
    const isGuarded = owner.kind !== MODULE_KINDS.core && !staysOpenWhenOff;
    const route = !isGuarded
      ? handler
      : withRouteLogging(scope, async (...handlerArguments: Arguments) => {
          if (!(await isModuleEnabled(getDatabase(), owner))) return Response.json({ code: REQUEST_ERROR_CODES.moduleOff, message: MODULE_OFF_MESSAGE }, { status: NOT_FOUND_STATUS });
          return handler(...handlerArguments);
        });
    recordRouteFacts(route, { ownerId: owner.id, scope, access, staysOpenWhenOff });
    return route;
  }

  return {
    member<Schema extends z.ZodType>(
      scope: string,
      bodySchema: Schema,
      respond: (context: RequestContext, body: z.infer<Schema>) => Promise<Response>,
      options: MemberRouteOptions & ModuleRouteOptions = {},
    ) {
      const access = options.adminOnly ? ROUTE_ACCESS.admin : ROUTE_ACCESS.member;
      return declare(createMemberRoute(scope, bodySchema, respond, options), scope, access, options);
    },
    memberBinary(scope: string, binaryOptions: BinaryRouteOptions, respond: BinaryResponder, options: ModuleRouteOptions = {}) {
      return declare(createMemberBinaryRoute(scope, binaryOptions, respond), scope, ROUTE_ACCESS.member, options);
    },
    adminBinary(scope: string, binaryOptions: BinaryRouteOptions, respond: BinaryResponder, options: ModuleRouteOptions = {}) {
      return declare(createAdminBinaryRoute(scope, binaryOptions, respond), scope, ROUTE_ACCESS.admin, options);
    },
    open<Arguments extends unknown[]>(scope: string, handler: (...handlerArguments: Arguments) => Promise<Response>, options: ModuleRouteOptions = {}) {
      return declare(withRouteLogging(scope, handler), scope, ROUTE_ACCESS.public, options);
    },
  };
}
