import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postCheck } from "@/app/api/admin/email/check/route";
import { POST as postTest } from "@/app/api/admin/email/test/route";
import { dnsCheckSchema } from "@/platform/email/dns-check-contract";
import { emailOutbox } from "@/platform/email/schema";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { createSignedInMember } from "@/test/signed-in-member";

// The check route uses the real resolver; here it is a stub that knows no records, so nothing reaches real DNS.
vi.mock("node:dns", () => ({
  promises: { resolveTxt: async () => Promise.reject(Object.assign(new Error("not found"), { code: "ENOTFOUND" })) },
}));

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const FORBIDDEN_STATUS = 403;
const CONFLICT_STATUS = 409;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function call(handler: (request: Request) => Promise<Response>, member: Member) {
  return handler(
    new Request(`${APP_URL}/api/admin/email`, { method: "POST", headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie }, body: "{}" }),
  );
}

describe("the admin's email setup", () => {
  const database = createTestDatabase();
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let admin: Member;
  let member: Member;

  function turnEmailOn(from = "Northwind <hello@mail.test-domain.example>") {
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", from);
    vi.stubEnv("RESEND_API_URL", resend.url);
  }

  beforeAll(async () => {
    resend = await startFakeResendServer();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    resend.reset();
    admin = await createSignedInMember(database, "admin");
    member = await createSignedInMember(database);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await resend.stop();
    await database.$client.end();
  });

  it("shows the records the sending domain is missing", async () => {
    turnEmailOn();

    const response = await call(postCheck, admin);

    expect(response.status).toBe(OK_STATUS);
    const check = dnsCheckSchema.parse(await response.json());
    expect(check.domain).toBe("mail.test-domain.example");
    expect(check.lines.map(({ status, toAdd }) => [status, toAdd?.name])).toEqual([
      ["missing", "send.mail.test-domain.example"],
      ["missing", "resend._domainkey.mail.test-domain.example"],
      ["missing", "_dmarc.test-domain.example"],
    ]);
  });

  it("says email is off instead of checking", async () => {
    expect((await call(postCheck, admin)).status).toBe(CONFLICT_STATUS);
  });

  it("sends a test to the admin's own address only, through the outbox", async () => {
    turnEmailOn();

    const response = await call(postTest, admin);

    expect(await response.json()).toMatchObject({ outcome: "sent" });
    expect(resend.state.emails.map(({ body }) => (body as { to: string[] }).to)).toEqual([[admin.email]]);
    expect(await database.select({ kind: emailOutbox.kind, status: emailOutbox.status }).from(emailOutbox)).toEqual([{ kind: "email_test", status: "sent" }]);
  });

  it("is for admins only", async () => {
    turnEmailOn();

    expect((await call(postCheck, member)).status).toBe(FORBIDDEN_STATUS);
    expect((await call(postTest, member)).status).toBe(FORBIDDEN_STATUS);
    expect(resend.state.emails).toEqual([]);
  });
});
