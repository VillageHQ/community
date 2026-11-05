import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditEntry } from "@/database/admin-schema";
import { session, user } from "@/database/auth-schema";
import { AUDIT_ACTIONS } from "@/lib/admin/admin-api";
import { getAuth } from "@/lib/auth";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST } from "./route";

const APP_URL = "http://localhost:3000";
const SETUP_TOKEN = "a-strong-setup-token-with-more-than-32-characters";
const NEW_PASSWORD = "a-brand-new-long-password";
const MAXIMUM_FAILED_ATTEMPTS = 10;

function recoverRequest(body: unknown, origin: string | null = APP_URL) {
  return new Request(`${APP_URL}/api/recover-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
}

describe("recovering an admin password with the setup token", () => {
  const database = createTestDatabase();

  async function signIn(email: string, password: string) {
    const auth = await getAuth();
    return auth.api.signInEmail({ body: { email, password }, asResponse: true });
  }

  beforeEach(async () => {
    await clearDatabase(database);
    vi.stubEnv("SETUP_TOKEN", SETUP_TOKEN);
    vi.stubEnv("RESEND_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("changes the password, ends every session, and writes the audit log", async () => {
    const admin = await createSignedInMember(database, "admin");

    const response = await POST(recoverRequest({ token: SETUP_TOKEN, email: admin.email, newPassword: NEW_PASSWORD }));

    expect(response.status).toBe(200);
    expect(await database.select().from(session).where(eq(session.userId, admin.userId))).toEqual([]);
    expect((await signIn(admin.email, NEW_PASSWORD)).status).toBe(200);
    const [entry] = await database.select().from(adminAuditEntry);
    expect(entry).toMatchObject({ action: AUDIT_ACTIONS.adminPasswordRecovered, actorId: admin.userId });
  });

  it("matches the email case-insensitively", async () => {
    const admin = await createSignedInMember(database, "admin");

    expect((await POST(recoverRequest({ token: SETUP_TOKEN, email: admin.email.toUpperCase(), newPassword: NEW_PASSWORD }))).status).toBe(200);
  });

  describe("refuses", () => {
    it("a member's account, so the token can never open a member's messages", async () => {
      const member = await createSignedInMember(database);

      const response = await POST(recoverRequest({ token: SETUP_TOKEN, email: member.email, newPassword: NEW_PASSWORD }));

      expect(response.status).toBe(422);
      expect((await signIn(member.email, NEW_PASSWORD)).status).toBe(401);
      expect(await database.select().from(session).where(eq(session.userId, member.userId))).not.toEqual([]);
    });

    it("a removed admin", async () => {
      const admin = await createSignedInMember(database, "admin");
      await database.update(user).set({ banned: true }).where(eq(user.id, admin.userId));

      expect((await POST(recoverRequest({ token: SETUP_TOKEN, email: admin.email, newPassword: NEW_PASSWORD }))).status).toBe(422);
    });

    it("a wrong token, without changing anything", async () => {
      const admin = await createSignedInMember(database, "admin");

      const response = await POST(recoverRequest({ token: "wrong", email: admin.email, newPassword: NEW_PASSWORD }));

      expect(response.status).toBe(401);
      expect((await signIn(admin.email, NEW_PASSWORD)).status).toBe(401);
      expect(await database.select().from(adminAuditEntry)).toEqual([]);
    });

    it("repeated wrong tokens with a 429, but never the right one", async () => {
      const admin = await createSignedInMember(database, "admin");
      const statuses = [];
      for (let attempt = 0; attempt <= MAXIMUM_FAILED_ATTEMPTS; attempt += 1) {
        statuses.push((await POST(recoverRequest({ token: `wrong-${attempt}`, email: admin.email, newPassword: NEW_PASSWORD }))).status);
      }

      expect(statuses.at(-1)).toBe(429);
      expect((await POST(recoverRequest({ token: SETUP_TOKEN, email: admin.email, newPassword: NEW_PASSWORD }))).status).toBe(200);
    });

    it.each(["short", "aaaaaaaa", "1234567890123456"])("a weak setup token (%s), with recovery off", async (weakToken) => {
      vi.stubEnv("SETUP_TOKEN", weakToken);
      const admin = await createSignedInMember(database, "admin");

      expect((await POST(recoverRequest({ token: weakToken, email: admin.email, newPassword: NEW_PASSWORD }))).status).toBe(503);
    });

    it("a password that's too short", async () => {
      const admin = await createSignedInMember(database, "admin");

      expect((await POST(recoverRequest({ token: SETUP_TOKEN, email: admin.email, newPassword: "short" }))).status).toBe(422);
    });

    it("another site's request", async () => {
      const admin = await createSignedInMember(database, "admin");

      expect((await POST(recoverRequest({ token: SETUP_TOKEN, email: admin.email, newPassword: NEW_PASSWORD }, "https://evil.test"))).status).toBe(403);
      expect((await POST(recoverRequest({ token: SETUP_TOKEN, email: admin.email, newPassword: NEW_PASSWORD }, null))).status).toBe(403);
    });

    it("everyone when email is on, pointing at Forgot password", async () => {
      vi.stubEnv("RESEND_API_KEY", "key");
      vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.test>");
      const admin = await createSignedInMember(database, "admin");

      expect((await POST(recoverRequest({ token: SETUP_TOKEN, email: admin.email, newPassword: NEW_PASSWORD }))).status).toBe(409);
    });
  });
});
