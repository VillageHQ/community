import { hashPassword } from "better-auth/crypto";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { account, rateLimit, session, user, verification } from "../database/auth-schema";
import { clearDatabase, createTestDatabase } from "../test/database";
import { createAuth } from "./create-auth";
import { claimFirstAdmin } from "./first-admin";

const APP_URL = "http://localhost:3000";
const ADMIN = { name: "Ada", email: "ada@example.com", password: "correct-horse-battery" };
const JSON_HEADERS = { "Content-Type": "application/json", Origin: APP_URL };
const SIGN_IN_ATTEMPTS_PER_WINDOW = 3;
const WRONG_CREDENTIALS = { email: ADMIN.email, password: "wrong-password-1" };

describe("createAuth", () => {
  const database = createTestDatabase();
  const auth = createAuth("test-secret-with-at-least-32-characters", database, {
    APP_URL,
  });

  function createPost(path: string, body: unknown, headers: Record<string, string> = {}) {
    return new Request(`${APP_URL}/api/auth${path}`, {
      method: "POST",
      headers: { ...JSON_HEADERS, ...headers },
      body: JSON.stringify(body),
    });
  }

  function post(path: string, body: unknown, headers?: Record<string, string>) {
    return auth.handler(createPost(path, body, headers));
  }

  async function signInAsAdmin() {
    const response = await post("/sign-in/email", { email: ADMIN.email, password: ADMIN.password });
    return { cookie: response.headers.get("set-cookie") ?? "" };
  }

  async function readAdminId() {
    const [admin] = await database
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, ADMIN.email));
    if (!admin) throw new Error("Expected the admin to exist.");
    return admin.id;
  }

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$client.end();
  });

  describe("sign-up", () => {
    const signUp = { name: "Mallory", email: "mallory@example.com", password: "long-enough-password" };

    it("is closed before an admin exists", async () => {
      expect((await post("/sign-up/email", signUp)).ok).toBe(false);
    });

    it("is closed after an admin exists", async () => {
      await claimFirstAdmin(database, ADMIN);

      expect((await post("/sign-up/email", signUp)).ok).toBe(false);
    });
  });

  describe("sign-in", () => {
    beforeEach(async () => {
      await claimFirstAdmin(database, ADMIN);
    });

    it("accepts the claimed admin's password and returns the admin role", async () => {
      const response = await post("/sign-in/email", { email: ADMIN.email, password: ADMIN.password });
      const cookie = response.headers.get("set-cookie") ?? "";
      const session = await auth.api.getSession({ headers: new Headers({ cookie }) });

      expect(response.status).toBe(200);
      expect(session?.user.role).toBe("admin");
    });

    it("rejects a wrong password", async () => {
      const response = await post("/sign-in/email", { email: ADMIN.email, password: "wrong-password-1" });

      expect(response.status).toBe(401);
    });
  });

  describe("sign-in rate limit", () => {
    async function attemptSignIn(instance: typeof auth, headers: Record<string, string> = {}) {
      return instance.handler(createPost("/sign-in/email", WRONG_CREDENTIALS, headers));
    }

    it("ignores rotating X-Forwarded-For values", async () => {
      const statuses = [];
      for (let attempt = 0; attempt <= SIGN_IN_ATTEMPTS_PER_WINDOW; attempt += 1) {
        const response = await attemptSignIn(auth, { "x-forwarded-for": `203.0.113.${attempt}` });
        statuses.push(response.status);
      }

      expect(statuses.at(-1)).toBe(429);
    });

    it("shares its count across instances through the database", async () => {
      const otherInstance = createAuth("test-secret-with-at-least-32-characters", database, {
        APP_URL,
      });
      for (let attempt = 0; attempt < SIGN_IN_ATTEMPTS_PER_WINDOW; attempt += 1) {
        await attemptSignIn(auth);
      }

      expect((await attemptSignIn(otherInstance)).status).toBe(429);
      expect(await database.select().from(rateLimit)).not.toEqual([]);
    });

    describe("on Vercel", () => {
      const vercelAuth = createAuth("test-secret-with-at-least-32-characters", database, {
        APP_URL,
        VERCEL: "1",
      });

      it("limits each client by the platform header, whatever X-Forwarded-For says", async () => {
        for (let attempt = 0; attempt < SIGN_IN_ATTEMPTS_PER_WINDOW; attempt += 1) {
          await attemptSignIn(vercelAuth, {
            "x-vercel-forwarded-for": "203.0.113.1",
            "x-forwarded-for": `198.51.100.${attempt}`,
          });
        }

        const sameClient = await attemptSignIn(vercelAuth, {
          "x-vercel-forwarded-for": "203.0.113.1",
          "x-forwarded-for": "198.51.100.200",
        });
        const otherClient = await attemptSignIn(vercelAuth, {
          "x-vercel-forwarded-for": "203.0.113.2",
        });

        expect(sameClient.status).toBe(429);
        expect(otherClient.status).toBe(401);
      });
    });
  });

  describe("acting as a member", () => {
    const MEMBER_ID = "member-with-private-messages";
    const MEMBER_EMAIL = "member@example.com";
    const MEMBER_PASSWORD = "the-members-own-password";
    const ADMINS_PASSWORD_FOR_MEMBER = "password-the-admin-chose";

    async function seedMemberWithPassword() {
      await database.insert(user).values({ id: MEMBER_ID, name: "Member", email: MEMBER_EMAIL, emailVerified: true, role: "user" });
      await database.insert(account).values({
        id: `${MEMBER_ID}-account`,
        userId: MEMBER_ID,
        accountId: MEMBER_ID,
        providerId: "credential",
        password: await hashPassword(MEMBER_PASSWORD),
      });
    }

    async function readMemberSessions() {
      return database.select().from(session).where(eq(session.userId, MEMBER_ID));
    }

    async function readMemberPasswordHash() {
      const [row] = await database.select({ password: account.password }).from(account).where(eq(account.userId, MEMBER_ID));
      return row?.password;
    }

    beforeEach(async () => {
      await claimFirstAdmin(database, ADMIN);
      await seedMemberWithPassword();
    });

    describe.each([
      ["/admin/impersonate-user", () => ({ userId: MEMBER_ID })],
      ["/admin/stop-impersonating", () => ({})],
      ["/admin/set-user-password", () => ({ userId: MEMBER_ID, newPassword: ADMINS_PASSWORD_FOR_MEMBER })],
      ["/admin/list-user-sessions", () => ({ userId: MEMBER_ID })],
      ["/admin/revoke-user-session", () => ({ sessionToken: "any-token" })],
      ["/admin/create-user", () => ({ email: "new@example.com", password: ADMINS_PASSWORD_FOR_MEMBER, name: "New" })],
    ])("%s", (path, createBody) => {
      it("answers an admin as if it doesn't exist", async () => {
        const headers = await signInAsAdmin();

        const response = await post(path, createBody(), headers);

        expect(response.status).toBe(404);
        expect(response.headers.get("set-cookie")).toBeNull();
      });

      it("answers a visitor the same way", async () => {
        expect((await post(path, createBody())).status).toBe(404);
      });
    });

    it("mints no session when an admin tries to impersonate", async () => {
      const headers = await signInAsAdmin();
      await post("/admin/impersonate-user", { userId: MEMBER_ID }, headers);

      expect(await readMemberSessions()).toEqual([]);
    });

    it("refuses impersonation through the server API too", async () => {
      const headers = await signInAsAdmin();

      await expect(auth.api.impersonateUser({ body: { userId: MEMBER_ID }, headers: new Headers(headers) })).rejects.toThrow();
      expect(await readMemberSessions()).toEqual([]);
    });

    it("leaves the member's password alone when an admin tries to set it", async () => {
      const headers = await signInAsAdmin();
      const before = await readMemberPasswordHash();

      await post("/admin/set-user-password", { userId: MEMBER_ID, newPassword: ADMINS_PASSWORD_FOR_MEMBER }, headers);

      expect(await readMemberPasswordHash()).toBe(before);
      const signIn = await post("/sign-in/email", { email: MEMBER_EMAIL, password: ADMINS_PASSWORD_FOR_MEMBER });
      expect(signIn.status).toBe(401);
    });

    it("refuses setting a password through the server API too", async () => {
      const headers = await signInAsAdmin();
      const before = await readMemberPasswordHash();

      await expect(
        auth.api.setUserPassword({ body: { userId: MEMBER_ID, newPassword: ADMINS_PASSWORD_FOR_MEMBER }, headers: new Headers(headers) }),
      ).rejects.toThrow();
      expect(await readMemberPasswordHash()).toBe(before);
    });

    it("returns no session token to an admin listing sessions", async () => {
      const memberSignIn = await post("/sign-in/email", { email: MEMBER_EMAIL, password: MEMBER_PASSWORD });
      expect(memberSignIn.status).toBe(200);
      const [memberSession] = await readMemberSessions();
      const headers = await signInAsAdmin();

      const response = await post("/admin/list-user-sessions", { userId: MEMBER_ID }, headers);

      expect(await response.text()).not.toContain(memberSession?.token ?? "no-token");
    });

    it.each([
      ["email", { email: "admin-controlled@example.com" }],
      ["emailVerified", { emailVerified: false }],
      ["id", { id: "another-id" }],
      ["image", { image: "https://evil.test/a.png" }],
    ])("refuses an admin changing a member's %s", async (_field, data) => {
      const headers = await signInAsAdmin();

      const response = await post("/admin/update-user", { userId: MEMBER_ID, data }, headers);

      expect(response.status).toBe(403);
      const [row] = await database.select({ email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, MEMBER_ID));
      expect(row).toEqual({ email: MEMBER_EMAIL, emailVerified: true });
    });

    it("still lets an admin rename a member", async () => {
      const headers = await signInAsAdmin();

      const response = await post("/admin/update-user", { userId: MEMBER_ID, data: { name: "Renamed" } }, headers);

      expect(response.status).toBe(200);
    });

    it("still lets an admin ban a member", async () => {
      const headers = await signInAsAdmin();

      expect((await post("/admin/ban-user", { userId: MEMBER_ID }, headers)).status).toBe(200);
    });

    it("issues no password reset token", async () => {
      await post("/request-password-reset", { email: MEMBER_EMAIL });

      expect(await database.select().from(verification).where(like(verification.identifier, "reset-password%"))).toEqual([]);
    });

    it("keeps the member's own sign-in working", async () => {
      expect((await post("/sign-in/email", { email: MEMBER_EMAIL, password: MEMBER_PASSWORD })).status).toBe(200);
    });
  });

  describe("last admin protection", () => {
    beforeEach(async () => {
      await claimFirstAdmin(database, ADMIN);
    });

    it.each([
      ["/admin/set-role", (userId: string) => ({ userId, role: "user" })],
      ["/admin/update-user", (userId: string) => ({ userId, data: { role: "user" } })],
      ["/admin/update-user", (userId: string) => ({ userId, data: { banned: true } })],
      ["/admin/ban-user", (userId: string) => ({ userId })],
      ["/admin/remove-user", (userId: string) => ({ userId })],
    ])("blocks %s for the only admin", async (path, createBody) => {
      const headers = await signInAsAdmin();
      const adminId = await readAdminId();

      const response = await post(path, createBody(adminId), headers);
      const [admin] = await database.select().from(user).where(eq(user.id, adminId));

      expect(response.status).toBe(403);
      expect(admin?.role).toBe("admin");
      expect(admin?.banned).toBe(false);
    });

    describe("with disguised inputs", () => {
      it.each([
        ["/admin/set-role", "userId as an array", (id: string) => ({ userId: [id], role: "user" })],
        [
          "/admin/update-user",
          "userId as an array",
          (id: string) => ({ userId: [id], data: { role: "user" } }),
        ],
        ["/admin/ban-user", "userId as an array", (id: string) => ({ userId: [id] })],
        ["/admin/remove-user", "userId as an array", (id: string) => ({ userId: [id] })],
        [
          "/admin/update-user",
          "banned as a string",
          (id: string) => ({ userId: id, data: { banned: "true" } }),
        ],
        ["/admin/update-user", "banned as 1", (id: string) => ({ userId: id, data: { banned: 1 } })],
        ["/admin/set-role", "a padded role", (id: string) => ({ userId: id, role: " admin" })],
        [
          "/admin/update-user",
          "a padded role",
          (id: string) => ({ userId: id, data: { role: " admin" } }),
        ],
        ["/admin/set-role", "a cased role", (id: string) => ({ userId: id, role: "Admin" })],
        [
          "/admin/update-user",
          "a role of the wrong type",
          (id: string) => ({ userId: id, data: { role: 1 } }),
        ],
      ])("rejects %s with %s", async (path, _input, createBody) => {
        const headers = await signInAsAdmin();
        const adminId = await readAdminId();

        const response = await post(path, createBody(adminId), headers);
        const [admin] = await database.select().from(user).where(eq(user.id, adminId));

        expect(response.ok).toBe(false);
        expect(admin?.role).toBe("admin");
        expect(admin?.banned).toBe(false);
      });
    });

    it("allows unrelated profile updates", async () => {
      const headers = await signInAsAdmin();

      const response = await post(
        "/admin/update-user",
        { userId: await readAdminId(), data: { name: "Ada Lovelace" } },
        headers,
      );

      expect(response.status).toBe(200);
    });

    it("allows demoting an admin while another remains", async () => {
      await database.insert(user).values({
        id: "second-admin",
        name: "Grace",
        email: "grace@example.com",
        role: "admin",
      });
      const headers = await signInAsAdmin();

      const response = await post(
        "/admin/set-role",
        { userId: "second-admin", role: "user" },
        headers,
      );

      expect(response.status).toBe(200);
    });
  });

  describe("changing a name through update-user", () => {
    async function updateName(name: string) {
      await claimFirstAdmin(database, ADMIN);
      const { cookie } = await signInAsAdmin();
      return post("/update-user", { name }, { Cookie: cookie });
    }

    it("refuses a name too long for the directory", async () => {
      const response = await updateName("n".repeat(15_000));

      expect(response.ok).toBe(false);
      const [admin] = await database.select({ name: user.name }).from(user);
      expect(admin?.name).toBe(ADMIN.name);
    });

    it("refuses a NUL byte with a 400, not a 500", async () => {
      const response = await updateName("Ada\0");

      expect(response.status).toBe(400);
      const [admin] = await database.select({ name: user.name }).from(user);
      expect(admin?.name).toBe(ADMIN.name);
    });

    it("accepts a normal name", async () => {
      expect((await updateName("Ada Lovelace")).ok).toBe(true);
    });
  });
});
