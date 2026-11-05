import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { and, eq, ilike, or, isNull } from "drizzle-orm";
import { z } from "zod";

import { user } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import { nameSchema } from "./invites/invite-api.ts";

const ADMIN_ROLE = "admin";
const ROLE_SEPARATOR = ",";
const UPDATE_USER_PATH = "/update-user";
const ADMIN_UPDATE_USER_PATH = "/admin/update-user";

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

const NULL_BYTE = "\0";
const NULL_BYTE_MESSAGE = "This name has a character we can't save.";
const REFUSED_PATHS: ReadonlySet<string> = new Set(["/verify-email"]);
const ADMIN_PATH_PREFIX = "/admin/";

// Anything else under /admin/ can act as a member, or leak what could: impersonation, setting
// a password, listing session tokens. Fail closed, so an upgrade can't add a route unnoticed.
const ALLOWED_ADMIN_PATHS: ReadonlySet<string> = new Set([
  "/admin/ban-user",
  "/admin/get-user",
  "/admin/has-permission",
  "/admin/list-users",
  "/admin/remove-user",
  "/admin/revoke-user-sessions",
  "/admin/set-role",
  "/admin/unban-user",
  "/admin/update-user",
]);

const ADMIN_UPDATABLE_FIELDS: ReadonlySet<string> = new Set(["name", "role", "banned", "banReason", "banExpires"]);

const adminUpdateFieldsSchema = z.object({ data: z.record(z.string(), z.unknown()) });

function isRefusedPath(path: string) {
  if (REFUSED_PATHS.has(path)) return true;
  return path.startsWith(ADMIN_PATH_PREFIX) && !ALLOWED_ADMIN_PATHS.has(path);
}

function rejectIdentityChange(path: string, body: unknown) {
  if (path !== ADMIN_UPDATE_USER_PATH) return;
  const update = adminUpdateFieldsSchema.safeParse(body);
  if (!update.success) return;
  if (Object.keys(update.data.data).every((field) => ADMIN_UPDATABLE_FIELDS.has(field))) return;
  throw new APIError("FORBIDDEN", { message: "Admins can't change a member's sign-in details." });
}

const nameUpdateSchema = z.object({
  name: z
    .string()
    .refine((name) => !name.includes(NULL_BYTE), NULL_BYTE_MESSAGE)
    .pipe(nameSchema)
    .optional(),
});

function rejectUnsafeName(path: string, body: unknown) {
  if (path !== UPDATE_USER_PATH) return;
  const update = nameUpdateSchema.safeParse(body);
  if (update.success) return;
  throw new APIError("BAD_REQUEST", { message: update.error.issues[0]?.message ?? "This name won't work." });
}

export function createAuthGuards(database: Database) {
  return createAuthMiddleware(async (context) => {
    if (isRefusedPath(context.path)) throw new APIError("NOT_FOUND");
    rejectUnsafeName(context.path, context.body);
    rejectIdentityChange(context.path, context.body);

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
