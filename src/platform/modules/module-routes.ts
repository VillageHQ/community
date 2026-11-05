import "server-only";

import type { z } from "zod";

import { createMemberRoutes, type BinaryResponder, type BinaryRouteOptions, type MemberRouteOptions } from "../http/member-route.ts";
import type { RequestContext } from "../http/request-context.ts";
import { withRouteLogging } from "../observability/route-logging.ts";
import { respondToVillageError } from "../village/route-errors.ts";
import type { ModuleManifest } from "./manifest.ts";
import { recordRouteFacts, ROUTE_ACCESS, type RouteAccess } from "./route-facts.ts";

type ModuleRouteOptions = { staysOpenWhenOff?: boolean };

const { createMemberRoute, createAdminBinaryRoute, createMemberBinaryRoute } = createMemberRoutes([respondToVillageError]);

export function createModuleRoutes(owner: ModuleManifest) {
  function declare<Handler extends object>(handler: Handler, scope: string, access: RouteAccess, { staysOpenWhenOff = false }: ModuleRouteOptions) {
    recordRouteFacts(handler, { ownerId: owner.id, scope, access, staysOpenWhenOff });
    return handler;
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
