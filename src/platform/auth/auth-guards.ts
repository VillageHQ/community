import { APIError, createAuthMiddleware } from "better-auth/api";
import { z } from "zod";

import type { Database } from "../database/client.ts";
import { recordFailedAttempt, releaseAttempt } from "../rate-limit/attempt-rate-limit.ts";
import { nameSchema } from "./member-name.ts";

const UPDATE_USER_PATH = "/update-user";
const SIGN_IN_PATH = "/sign-in/email";
const SIGN_IN_KEY_PREFIX = "sign-in-email";
const MAXIMUM_FAILED_SIGN_INS_PER_EMAIL_PER_MINUTE = 5;

const NULL_BYTE = "\0";
const NULL_BYTE_MESSAGE = "This name has a character we can't save.";
const REFUSED_PATHS: ReadonlySet<string> = new Set(["/verify-email", "/reset-password/:token"]);
const ADMIN_PATH_PREFIX = "/admin/";
const SIGN_IN_LINK_PATH = "/sign-in/magic-link";

// Anything else under /admin/ can act as a member, or leak what could: impersonation, setting
// a password, listing session tokens. Fail closed, so an upgrade can't add a route unnoticed.
// Roles, bans and removals go only through /api/admin/members, which audits them and holds the
// admin roster lock from check to write. Better Auth can't run its writes inside that transaction.
const ALLOWED_ADMIN_PATHS: ReadonlySet<string> = new Set([
  "/admin/get-user",
  "/admin/has-permission",
  "/admin/list-users",
]);

type AuthGuardOptions = { isEmailOn: boolean };

function isRefusedPath(path: string, { isEmailOn }: AuthGuardOptions) {
  if (REFUSED_PATHS.has(path)) return true;
  if (path === SIGN_IN_LINK_PATH && !isEmailOn) return true;
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

const signInBodySchema = z.object({ email: z.string() });

function readSignInKey(path: string, body: unknown) {
  if (path !== SIGN_IN_PATH) return null;
  const signIn = signInBodySchema.safeParse(body);
  return signIn.success ? `${SIGN_IN_KEY_PREFIX}|${signIn.data.email.trim().toLowerCase()}` : null;
}

// Failed sign-ins are counted per account, so one person's wrong passwords can't lock anyone
// else out. Better Auth adds its own per-IP limit when a trusted IP header is set (see create-auth).
// Each try takes a slot before the password is checked, and a successful one gives it back, so
// guesses sent all at once are capped too.
export function createAuthGuards(database: Database, options: AuthGuardOptions) {
  return createAuthMiddleware(async (context) => {
    if (isRefusedPath(context.path, options)) throw new APIError("NOT_FOUND");
    rejectUnsafeName(context.path, context.body);
    const signInKey = readSignInKey(context.path, context.body);
    if (!signInKey) return;
    const { isLimited } = await recordFailedAttempt(database, signInKey, MAXIMUM_FAILED_SIGN_INS_PER_EMAIL_PER_MINUTE);
    if (isLimited) {
      throw new APIError("TOO_MANY_REQUESTS", { message: "Too many tries for this account. Wait a minute, then try again." });
    }
  });
}

export function createAuthAfterHooks(database: Database) {
  return createAuthMiddleware(async (context) => {
    const signInKey = readSignInKey(context.path, context.body);
    if (signInKey && !(context.context.returned instanceof APIError)) await releaseAttempt(database, signInKey);
  });
}
