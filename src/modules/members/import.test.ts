import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditEntry } from "@/platform/audit/schema";
import { emailOutbox } from "@/platform/email/schema";
import { invite } from "@/modules/members/schema";
import { importResultSchema, readImportBasis } from "@/modules/members/contract-import";
import { issuedInviteSchema } from "@/modules/members/contract-invites";
import { readFillInSettings } from "@/modules/members/service-fill-in";
import { readWaitingInviteLinks } from "@/modules/members/service-invite-links";
import { readInviteByToken } from "@/modules/members/service-invites";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postImport } from "@/app/api/admin/invites/import/route";
import { POST as postCopyLink } from "@/app/api/admin/invites/copy-link/route";

const APP_URL = "http://localhost:3000";
const CSV = "name,email,company,cohort\nAda Founder,ada@example.com,Gridwise,Fund III\nSam Lee,sam@example.com,Tallyhealth,Fund II\nBroken,not-an-email,Nowhere,Fund I\n";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function importRequest(member: Member, query: string, body = CSV) {
  return new Request(`${APP_URL}/api/admin/invites/import?${query}`, { method: "POST", headers: { "Content-Type": "text/csv", Origin: APP_URL, Cookie: member.cookie }, body });
}

describe("the import's fill-in basis", () => {
  it("takes ask, or terms with a date no later than today", () => {
    const today = new Date("2026-11-11T12:00:00Z");
    expect(readImportBasis("ask", null, today)).toEqual({ basis: "ask" });
    expect(readImportBasis("terms", "2026-04-25", today)).toEqual({ basis: "terms", termsDate: "2026-04-25" });
    expect(readImportBasis("terms", "2026-12-01", today)).toHaveProperty("error");
    expect(readImportBasis("terms", "", today)).toHaveProperty("error");
    expect(readImportBasis(null, null, today)).toHaveProperty("error");
  });
});

describe("Set up › Import members and Sign-in links, with mail on", () => {
  const database = createTestDatabase();
  let admin: Member;
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;

  beforeAll(async () => {
    resend = await startFakeResendServer();
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.test>");
    vi.stubEnv("RESEND_API_URL", resend.url);
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await resend.stop();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    admin = await createSignedInMember(database, "admin");
  });

  it("imports without emailing when the switch is off, saves the basis, and the invites wait on Sign-in links", async () => {
    const response = await postImport(importRequest(admin, "basis=ask"));
    expect(response.status).toBe(200);
    const result = importResultSchema.parse(await response.json());

    expect(result).toMatchObject({ importedCount: 2, problemCount: 1, rowCount: 2, isEmailing: false });
    expect(result.imported.map(({ email, company, cohort }) => [email, company, cohort])).toEqual([
      ["ada@example.com", "Gridwise", "Fund III"],
      ["sam@example.com", "Tallyhealth", "Fund II"],
    ]);
    expect(result.notImported).toEqual([{ line: 4, why: "This isn't a valid email address." }]);
    expect(await database.select().from(emailOutbox)).toHaveLength(0);
    expect(await readFillInSettings(database)).toEqual({ basis: "ask", termsDate: null });
    const audit = await database.select({ action: adminAuditEntry.action, detail: adminAuditEntry.detail }).from(adminAuditEntry);
    expect(audit).toEqual(expect.arrayContaining([{ action: "fill_in_basis_changed", detail: "ask" }, expect.objectContaining({ action: "invite_created", detail: "From a CSV import" })]));

    const waiting = await readWaitingInviteLinks(database, { isMailOn: true });
    expect(waiting.map(({ email }) => email).sort()).toEqual(["ada@example.com", "sam@example.com"]);
  });

  it("emails each invite when the switch is on, and those don't wait on Sign-in links", async () => {
    const result = importResultSchema.parse(await (await postImport(importRequest(admin, "basis=terms&termsDate=2026-01-02&invite=1"))).json());

    expect(result).toMatchObject({ importedCount: 2, isEmailing: true });
    expect(await database.select().from(emailOutbox)).toHaveLength(2);
    expect(await readFillInSettings(database)).toEqual({ basis: "terms", termsDate: "2026-01-02" });
    expect(await readWaitingInviteLinks(database, { isMailOn: true })).toEqual([]);
    expect((await readWaitingInviteLinks(database, { isMailOn: false })).map(({ email }) => email).sort()).toEqual(["ada@example.com", "sam@example.com"]);
  });

  it("refuses an import with no basis, and changes nothing", async () => {
    const response = await postImport(importRequest(admin, ""));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ field: "basis" });
    expect(await database.select().from(invite)).toHaveLength(0);
  });

  it("refuses a member who isn't an admin", async () => {
    const member = await createSignedInMember(database, "user");
    expect((await postImport(importRequest(member, "basis=ask"))).status).toBe(403);
  });

  it("copies a new working link without emailing, and the one before stops working", async () => {
    await postImport(importRequest(admin, "basis=ask"));
    const [row] = await database.select().from(invite).where(eq(invite.email, "ada@example.com"));
    const copy = () =>
      postCopyLink(new Request(`${APP_URL}/api/admin/invites/copy-link`, { method: "POST", headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: admin.cookie }, body: JSON.stringify({ inviteId: row?.id }) }));

    const first = issuedInviteSchema.parse(await (await copy()).json());
    const second = issuedInviteSchema.parse(await (await copy()).json());
    const tokenOf = (link: string) => link.split("/").at(-1) ?? "";

    expect(await readInviteByToken(database, tokenOf(first.link))).toBeNull();
    expect(await readInviteByToken(database, tokenOf(second.link))).toMatchObject({ email: "ada@example.com" });
    expect(await database.select().from(emailOutbox)).toHaveLength(0);
    expect((await readWaitingInviteLinks(database, { isMailOn: true })).map(({ email }) => email)).toContain("ada@example.com");
  });
});
