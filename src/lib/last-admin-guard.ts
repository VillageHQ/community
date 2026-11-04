import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { and, eq, ilike, or, isNull } from "drizzle-orm";
import { z } from "zod";

import { user } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";

const ADMIN_ROLE = "admin";
const ROLE_SEPARATOR = ",";

const roleSchema = z.union([z.string(), z.array(z.string())]);

const adminChangeSchema = z.object({
  userId: z.string(),
  role: roleSchema.optional(),
  data: z.object({ role: roleSchema.optional(), banned: z.unknown().optional() }).optional(),
});

type AdminChange = z.infer<typeof adminChangeSchema>;
type Role = z.infer<typeof roleSchema>;

function includesAdminRole(role: Role) {
  const roles = Array.isArray(role) ? role : role.split(ROLE_SEPARATOR);
  return roles.includes(ADMIN_ROLE);
}

const ADMIN_LOSS_CHECKS: Record<string, (change: AdminChange) => boolean> = {
  "/admin/remove-user": () => true,
  "/admin/ban-user": () => true,
  "/admin/set-role": ({ role }) => role === undefined || !includesAdminRole(role),
  "/admin/update-user": ({ data }) => {
    const losesRole = data?.role !== undefined && !includesAdminRole(data.role);
    const mayBan = data?.banned !== undefined && data.banned !== false;
    return losesRole || mayBan;
  },
};

async function isLastActiveAdmin(database: Database, userId: string) {
  const candidates = await database
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(
      and(ilike(user.role, `%${ADMIN_ROLE}%`), or(eq(user.banned, false), isNull(user.banned))),
    );
  const admins = candidates.filter(({ role }) => role !== null && includesAdminRole(role));
  return admins.length === 1 && admins[0]?.id === userId;
}

export function createLastAdminGuard(database: Database) {
  return createAuthMiddleware(async (context) => {
    const losesAdmin = ADMIN_LOSS_CHECKS[context.path];
    if (!losesAdmin) return;

    const session = await getSessionFromCtx(context);
    if (!session) return;

    const change = adminChangeSchema.safeParse(context.body);
    if (!change.success) {
      throw new APIError("BAD_REQUEST", { message: "This admin change is malformed." });
    }
    if (!losesAdmin(change.data)) return;

    if (await isLastActiveAdmin(database, change.data.userId)) {
      throw new APIError("FORBIDDEN", { message: "This community needs at least one admin." });
    }
  });
}
