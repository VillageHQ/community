import { and, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";

type MemberTable = { banned: AnyPgColumn; banExpires: AnyPgColumn };

export function isActiveMember(now = new Date(), members: MemberTable = user) {
  return or(
    isNull(members.banned),
    eq(members.banned, false),
    and(isNotNull(members.banExpires), lte(members.banExpires, now)),
  );
}

export function isBanInEffect(now = new Date()) {
  return sql<boolean>`coalesce(${user.banned}, false) and (${or(isNull(user.banExpires), gt(user.banExpires, now))})`;
}

type BanFields = { banned?: boolean | null; banExpires?: Date | null };

export function isBanActive({ banned, banExpires }: BanFields, now = new Date()) {
  if (!banned) return false;
  return !banExpires || banExpires > now;
}
