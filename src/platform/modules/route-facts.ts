export const ROUTE_ACCESS = { public: "public", member: "member", admin: "admin" } as const;

export type RouteAccess = (typeof ROUTE_ACCESS)[keyof typeof ROUTE_ACCESS];

export type RouteFacts = { ownerId: string; scope: string; access: RouteAccess; staysOpenWhenOff: boolean };

const ROUTE_FACTS = new WeakMap<object, RouteFacts>();
const PAGE_OWNERS = new WeakMap<object, string>();

export function recordRouteFacts(handler: object, facts: RouteFacts) {
  ROUTE_FACTS.set(handler, facts);
}

export function readRouteFacts(handler: object) {
  return ROUTE_FACTS.get(handler) ?? null;
}

export function recordPageOwner(page: object, ownerId: string) {
  PAGE_OWNERS.set(page, ownerId);
}

export function readPageOwner(page: object) {
  return PAGE_OWNERS.get(page) ?? null;
}
