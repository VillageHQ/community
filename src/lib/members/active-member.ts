import { and, eq, isNotNull, isNull, lte, or } from "drizzle-orm";

import { user } from "../../database/auth-schema.ts";

export function isActiveMember(now = new Date()) {
  return or(
    isNull(user.banned),
    eq(user.banned, false),
    and(isNotNull(user.banExpires), lte(user.banExpires, now)),
  );
}
