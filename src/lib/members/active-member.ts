import { and, eq, isNotNull, isNull, lte, or } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { user } from "../../database/auth-schema.ts";

type MemberTable = { banned: AnyPgColumn; banExpires: AnyPgColumn };

export function isActiveMember(now = new Date(), members: MemberTable = user) {
  return or(
    isNull(members.banned),
    eq(members.banned, false),
    and(isNotNull(members.banExpires), lte(members.banExpires, now)),
  );
}

type BanFields = { banned?: boolean | null; banExpires?: Date | null };

export function isBanActive({ banned, banExpires }: BanFields, now = new Date()) {
  if (!banned) return false;
  return !banExpires || banExpires > now;
}
