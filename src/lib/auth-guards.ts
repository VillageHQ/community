import { APIError, createAuthMiddleware } from "better-auth/api";
import { z } from "zod";

import { nameSchema } from "./invites/invite-api.ts";

const UPDATE_USER_PATH = "/update-user";

const NULL_BYTE = "\0";
const NULL_BYTE_MESSAGE = "This name has a character we can't save.";
const REFUSED_PATHS: ReadonlySet<string> = new Set(["/verify-email", "/reset-password/:token"]);
const ADMIN_PATH_PREFIX = "/admin/";

// Anything else under /admin/ can act as a member, or leak what could: impersonation, setting
// a password, listing session tokens. Fail closed, so an upgrade can't add a route unnoticed.
// Roles, bans and removals go only through /api/admin/members, which audits them and holds the
// admin roster lock from check to write. Better Auth can't run its writes inside that transaction.
const ALLOWED_ADMIN_PATHS: ReadonlySet<string> = new Set([
  "/admin/get-user",
  "/admin/has-permission",
  "/admin/list-users",
]);

function isRefusedPath(path: string) {
  if (REFUSED_PATHS.has(path)) return true;
  return path.startsWith(ADMIN_PATH_PREFIX) && !ALLOWED_ADMIN_PATHS.has(path);
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

export function createAuthGuards() {
  return createAuthMiddleware(async (context) => {
    if (isRefusedPath(context.path)) throw new APIError("NOT_FOUND");
    rejectUnsafeName(context.path, context.body);
  });
}
