import { hashPassword } from "better-auth/crypto";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditEntry } from "@/database/admin-schema";
import { account, session, user, verification } from "@/platform/database/auth-schema";
import { EVENTUALLY } from "@/test/async-timeouts";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { AUDIT_ACTIONS } from "@/lib/admin/admin-api";
import { createAuth } from "./create-auth";

const APP_URL = "http://localhost:3000";
const MEMBER = { id: "member-1", name: "Mo Member", email: "mo@example.test" };
const OLD_PASSWORD = "the-old-long-password";
const NEW_PASSWORD = "the-new-long-password";
const RESET_LINK_PATTERN = /\/reset-password\?token=([A-Za-z0-9_-]+)/;
const JSON_HEADERS = { "Content-Type": "application/json", Origin: APP_URL };
const RESET_REQUESTS_PER_MINUTE = 5;

describe("resetting a password by email", () => {
  const database = createTestDatabase();
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let auth: ReturnType<typeof createAuth>;

  function post(path: string, body: unknown, headers: Record<string, string> = {}) {
    return auth.handler(
      new Request(`${APP_URL}/api/auth${path}`, { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(body) }),
    );
  }

  async function waitForEmails(count: number) {
    await vi.waitFor(() => expect(resend.state.emails.length).toBeGreaterThanOrEqual(count), EVENTUALLY);
  }

  async function requestAndReadToken() {
    await post("/request-password-reset", { email: MEMBER.email });
    await waitForEmails(1);
    const [email] = resend.state.emails;
    return JSON.stringify(email?.body).match(RESET_LINK_PATTERN)?.[1] ?? "";
  }

  beforeAll(async () => {
    resend = await startFakeResendServer();
    auth = createAuth("test-secret-with-at-least-32-characters", database, {
      APP_URL,
      RESEND_API_KEY: FAKE_RESEND_API_KEY,
      RESEND_FROM_ADDRESS: "Northwind <hello@example.test>",
      RESEND_API_URL: resend.url,
    });
  });

  afterAll(() => resend.stop());

  beforeEach(async () => {
    await clearDatabase(database);
    await database.delete(verification);
    resend.reset();
    await database.insert(user).values({ ...MEMBER, emailVerified: true, role: "user" });
    await database.insert(account).values({
      id: "account-1",
      userId: MEMBER.id,
      accountId: MEMBER.id,
      providerId: "credential",
      password: await hashPassword(OLD_PASSWORD),
    });
  });

  it("emails a link to this site, not to Better Auth's route", async () => {
    const token = await requestAndReadToken();

    expect(token).not.toBe("");
    expect(JSON.stringify(resend.state.emails[0]?.body)).toContain(`${APP_URL}/reset-password?token=`);
  });

  it("answers the same for an unknown email, and sends nothing", async () => {
    const known = await post("/request-password-reset", { email: MEMBER.email });
    const unknown = await post("/request-password-reset", { email: "nobody@example.test" });
    await waitForEmails(1);

    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual(await known.json());
    expect(resend.state.emails).toHaveLength(1);
  });

  it("sends nothing to a removed member", async () => {
    await database.update(user).set({ banned: true }).where(eq(user.id, MEMBER.id));

    await post("/request-password-reset", { email: MEMBER.email });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(resend.state.emails).toEqual([]);
  });

  it("changes the password, ends every session, and writes the audit log", async () => {
    const signedIn = await post("/sign-in/email", { email: MEMBER.email, password: OLD_PASSWORD });
    expect(signedIn.status).toBe(200);
    const token = await requestAndReadToken();

    const response = await post("/reset-password", { token, newPassword: NEW_PASSWORD });

    expect(response.status).toBe(200);
    expect(await database.select().from(session).where(eq(session.userId, MEMBER.id))).toEqual([]);
    expect((await post("/sign-in/email", { email: MEMBER.email, password: NEW_PASSWORD })).status).toBe(200);
    const [entry] = await database.select().from(adminAuditEntry);
    expect(entry).toMatchObject({ action: AUDIT_ACTIONS.passwordReset, actorId: MEMBER.id });
  });

  it("works only once", async () => {
    const token = await requestAndReadToken();
    await post("/reset-password", { token, newPassword: NEW_PASSWORD });

    const again = await post("/reset-password", { token, newPassword: "yet-another-long-password" });

    expect(again.ok).toBe(false);
    expect((await post("/sign-in/email", { email: MEMBER.email, password: NEW_PASSWORD })).status).toBe(200);
  });

  it("refuses a made-up token", async () => {
    expect((await post("/reset-password", { token: "made-up", newPassword: NEW_PASSWORD })).ok).toBe(false);
  });

  it("slows down repeated requests", async () => {
    const statuses = [];
    for (let attempt = 0; attempt <= RESET_REQUESTS_PER_MINUTE; attempt += 1) {
      statuses.push((await post("/request-password-reset", { email: "nobody@example.test" })).status);
    }

    expect(statuses.at(-1)).toBe(429);
  });

  it("keeps Better Auth's GET link closed, so a mail scanner can't use a token", async () => {
    const token = await requestAndReadToken();

    const response = await auth.handler(new Request(`${APP_URL}/api/auth/reset-password/${token}?callbackURL=/`));

    expect(response.status).toBe(404);
    expect(await database.select().from(verification).where(like(verification.identifier, "reset-password%"))).toHaveLength(1);
  });
});
