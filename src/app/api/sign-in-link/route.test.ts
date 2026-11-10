import { hashPassword } from "better-auth/crypto";
import { eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { account, session, user, verification } from "@/platform/database/auth-schema";
import { sendDueEmails } from "@/platform/email/outbox-sender";
import { emailOutbox } from "@/platform/email/schema";
import { EVENTUALLY } from "@/test/async-timeouts";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";

const APP_URL = "http://localhost:3000";
const MEMBER = { id: "member-1", name: "Mo Member", email: "mo@example.test" };
const PASSWORD = "the-member-long-password";
const LINK_PATTERN = /\/sign-in\/link\?token=([A-Za-z0-9_-]+)/;
const JSON_HEADERS = { "Content-Type": "application/json", Origin: APP_URL };
const SETTLE_MS = 150;

describe("signing in by emailed link", () => {
  const database = createTestDatabase();
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let authRoute: typeof import("@/app/api/auth/[...all]/route");
  let linkRoute: typeof import("./route");

  function postAuth(path: string, body: unknown, headers: Record<string, string> = {}) {
    return authRoute.POST(new Request(`${APP_URL}/api/auth${path}`, { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(body) }));
  }

  function confirm(token: string, headers: Record<string, string> = {}) {
    return linkRoute.POST(new Request(`${APP_URL}/api/sign-in-link`, { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify({ token }) }));
  }

  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  }

  async function requestLink(email = MEMBER.email) {
    const before = resend.state.emails.length;
    const response = await postAuth("/sign-in/magic-link", { email });
    await vi.waitFor(() => expect(resend.state.emails.length).toBeGreaterThan(before), EVENTUALLY);
    const token = JSON.stringify(resend.state.emails.at(-1)?.body).match(LINK_PATTERN)?.[1] ?? "";
    return { response, token };
  }

  async function countSessions() {
    return (await database.select().from(session).where(eq(session.userId, MEMBER.id))).length;
  }

  beforeAll(async () => {
    resend = await startFakeResendServer();
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.test>");
    vi.stubEnv("RESEND_API_URL", resend.url);
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-with-at-least-32-characters");
    authRoute = await import("@/app/api/auth/[...all]/route");
    linkRoute = await import("./route");
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await resend.stop();
  });

  afterEach(() => {
    vi.stubEnv("CLIENT_IP_HEADER", "");
  });

  beforeEach(async () => {
    await clearDatabase(database);
    resend.reset();
    await database.insert(user).values({ ...MEMBER, emailVerified: true, role: "user" });
    await database.insert(account).values({ id: "account-1", userId: MEMBER.id, accountId: MEMBER.id, providerId: "credential", password: await hashPassword(PASSWORD) });
  });

  it("emails a link to the confirm page and stores only a hash of the token", async () => {
    const { response, token } = await requestLink();

    expect(response.status).toBe(200);
    expect(token).not.toBe("");
    const rows = await database.select().from(verification).where(like(verification.identifier, "magic-link:%"));
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0]!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(rows[0]!.expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    // Sent through the outbox, which drops the body, and so the link, once it goes out.
    await vi.waitFor(async () => {
      const [queued] = await database.select().from(emailOutbox);
      expect(queued).toMatchObject({ kind: "sign_in_link", toEmail: MEMBER.email, status: "sent", html: "", text: "" });
    }, EVENTUALLY);
  });

  it("signs in once from the button's POST, and never again with the same link", async () => {
    const { token } = await requestLink();

    const first = await confirm(token);
    expect(first.status).toBe(200);
    expect(first.headers.getSetCookie().join(";")).toContain("session_token");
    expect(await countSessions()).toBe(1);

    const second = await confirm(token);
    expect(second.status).toBe(410);
    expect(second.headers.getSetCookie()).toEqual([]);
    expect(await countSessions()).toBe(1);
  });

  it("does not sign in when only the link is opened with a GET", async () => {
    const { token } = await requestLink();

    const verify = await authRoute.GET(new Request(`${APP_URL}/api/auth/magic-link/verify?token=${token}&callbackURL=/`));
    expect(verify.status).toBe(404);
    expect(await countSessions()).toBe(0);
    expect((await confirm(token)).status).toBe(200);
  });

  it("refuses an expired link", async () => {
    const { token } = await requestLink();
    await database.update(verification).set({ expiresAt: new Date(Date.now() - 1000) }).where(like(verification.identifier, "magic-link:%"));

    expect((await confirm(token)).status).toBe(410);
    expect(await countSessions()).toBe(0);
  });

  it("answers an unknown email exactly like a member's, and sends nothing", async () => {
    const known = await postAuth("/sign-in/magic-link", { email: MEMBER.email });
    const unknown = await postAuth("/sign-in/magic-link", { email: "nobody@example.test" });
    await settle();

    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual(await known.json());
    expect(resend.state.emails).toHaveLength(1);
  });

  it("sends nothing to a banned member, and a link made before the ban stops working", async () => {
    const { token } = await requestLink();
    await database.update(user).set({ banned: true }).where(eq(user.id, MEMBER.id));

    const response = await postAuth("/sign-in/magic-link", { email: MEMBER.email });
    await settle();

    expect(response.status).toBe(200);
    expect(resend.state.emails).toHaveLength(1);
    expect((await confirm(token)).status).toBe(410);
    expect(await countSessions()).toBe(0);
  });

  it("limits links per email", async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await postAuth("/sign-in/magic-link", { email: MEMBER.email }, { "x-forwarded-for": `10.0.0.${attempt}` });
    }
    await settle();

    expect(resend.state.emails).toHaveLength(2);
  });

  it("limits wrong links per trusted IP, and nobody can block everyone's link when the IP is unknown", async () => {
    const { token } = await requestLink();
    const wrongToken = "x".repeat(32);

    for (let attempt = 0; attempt < 11; attempt += 1) expect((await confirm(wrongToken)).status).toBe(410);
    expect((await confirm(token)).status).toBe(200);

    vi.stubEnv("CLIENT_IP_HEADER", "x-real-ip");
    const second = await requestLink();
    for (let attempt = 0; attempt < 10; attempt += 1) await confirm(wrongToken, { "x-real-ip": "10.0.0.9" });
    expect((await confirm(second.token, { "x-real-ip": "10.0.0.9" })).status).toBe(429);
    expect((await confirm(second.token, { "x-real-ip": "10.0.0.10" })).status).toBe(200);
  });

  it("confirms the email, and tells the member when an unconfirmed password was removed", async () => {
    await database.update(user).set({ emailVerified: false }).where(eq(user.id, MEMBER.id));
    const { token } = await requestLink();

    const response = await confirm(token);

    expect(await response.json()).toEqual({ isPasswordRemoved: true });
    const [member] = await database.select({ emailVerified: user.emailVerified }).from(user).where(eq(user.id, MEMBER.id));
    expect(member?.emailVerified).toBe(true);
    expect(await database.select().from(account).where(eq(account.userId, MEMBER.id))).toEqual([]);
  });

  it("keeps password sign-in working", async () => {
    const response = await postAuth("/sign-in/email", { email: MEMBER.email, password: PASSWORD });

    expect(response.status).toBe(200);
  });

  it("refuses a confirm POST from another site", async () => {
    const { token } = await requestLink();

    expect((await confirm(token, { Origin: "https://evil.example" })).status).toBe(403);
    expect(await countSessions()).toBe(0);
  });

  it("never sends a link that died while it waited to be retried", async () => {
    vi.stubEnv("RESEND_API_URL", "http://127.0.0.1:9");
    await postAuth("/sign-in/magic-link", { email: MEMBER.email });
    await vi.waitFor(async () => {
      const [queued] = await database.select().from(emailOutbox);
      expect(queued).toMatchObject({ status: "pending", attempts: 1 });
    }, EVENTUALLY);
    const [queued] = await database.select().from(emailOutbox);
    const [link] = await database.select().from(verification).where(like(verification.identifier, "magic-link:%"));
    expect(queued!.expiresAt!.getTime()).toBeLessThan(link!.expiresAt.getTime());

    vi.stubEnv("RESEND_API_URL", resend.url);
    await database.update(emailOutbox).set({ nextAttemptAt: new Date(Date.now() - 1000) });
    const sixteenMinutesOn = Date.now() + 16 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(sixteenMinutesOn);
    try {
      await sendDueEmails(database, process.env);
    } finally {
      vi.restoreAllMocks();
    }

    expect(resend.state.emails).toHaveLength(0);
    const [finished] = await database.select().from(emailOutbox);
    expect(finished).toMatchObject({ status: "skipped", html: "", text: "" });
  });
});

describe("signing in by link with email off", () => {
  it("has no link endpoint, so sign-in stays password-only", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.resetModules();
    const { createAuth } = await import("@/platform/auth/create-auth");
    const auth = createAuth("test-secret-with-at-least-32-characters", createTestDatabase(), { APP_URL });

    const response = await auth.handler(
      new Request(`${APP_URL}/api/auth/sign-in/magic-link`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ email: MEMBER.email }) }),
    );

    expect(response.status).toBe(404);
    vi.unstubAllEnvs();
  });
});
