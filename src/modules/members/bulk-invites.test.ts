import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditEntry } from "@/platform/audit/schema";
import { memberProfile, invite } from "@/modules/members/schema";
import { acceptInvite, readInviteByToken } from "@/modules/members/service-invites";
import { bulkInviteResultSchema, parseInviteList, parseInvitesCsv, toCsv, toSafeCell } from "@/modules/members/contract-bulk-invites";
import { emailOutbox } from "@/platform/email/schema";
import { sendDueEmails } from "@/platform/email/outbox-sender";
import { EVENTUALLY } from "@/test/async-timeouts";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postBulk } from "@/app/api/admin/invites/bulk/route";
import { readInviteToken } from "@/test/invite-link";

const APP_URL = "http://localhost:3000";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function bulkRequest(member: Member, format: "list" | "csv", body: string) {
  return new Request(`${APP_URL}/api/admin/invites/bulk?format=${format}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain", Origin: APP_URL, Cookie: member.cookie },
    body,
  });
}

function founderCsv() {
  const rows = ["name,email,company,cohort"];
  for (let index = 1; index <= 50; index += 1) rows.push(`Founder ${index},founder${index}@example.com,Startup ${index},Spring 2026`);
  rows.push("Broken Row,not-an-email,Nowhere,Spring 2026");
  rows.push("Founder Again,FOUNDER7@example.com,Startup 7,Spring 2026");
  return rows.join("\n");
}

describe("reading a pasted list", () => {
  it("reads all three formats and quietly skips a header", () => {
    const { people, problems, skipped } = parseInviteList("name, email\nAda Lovelace, ada@example.com\nGrace Hopper <grace@example.com>\nlin@example.com\n");

    expect(people.map(({ email, name }) => [email, name])).toEqual([
      ["ada@example.com", "Ada Lovelace"],
      ["grace@example.com", "Grace Hopper"],
      ["lin@example.com", null],
    ]);
    expect(problems).toEqual([]);
    expect(skipped).toEqual([]);
  });

  it("names a line without an email and a repeated email", () => {
    const { people, problems, skipped } = parseInviteList("Ada, ada@example.com\njust a name\nADA@example.com");

    expect(people).toHaveLength(1);
    expect(problems).toEqual([{ line: 2, text: "just a name", why: "There's no email address on this line." }]);
    expect(skipped.map(({ line, email }) => [line, email])).toEqual([[3, "ada@example.com"]]);
  });

  it("refuses more than 500 people", () => {
    const lines = Array.from({ length: 501 }, (_, index) => `person${index}@example.com`).join("\n");

    expect(() => parseInviteList(lines)).toThrow(/at most 500/);
  });
});

describe("reading a CSV", () => {
  it("handles quotes, commas inside quotes, columns in any order and a byte order mark", () => {
    const { people } = parseInvitesCsv('﻿Email,Cohort,Name,Company\r\nada@example.com,"W26","Lovelace, Ada","Engines ""Ltd"""\r\n');

    expect(people).toEqual([{ line: 2, email: "ada@example.com", name: "Lovelace, Ada", company: 'Engines "Ltd"', cohort: "W26" }]);
  });

  it("drops leading formula characters from what it keeps", () => {
    const { people } = parseInvitesCsv('name,email,company\n"=HYPERLINK(""http://x"")",ada@example.com,+cmd|calc\n');

    expect(people[0]?.name).toBe('HYPERLINK("http://x")');
    expect(people[0]?.company).toBe("cmd|calc");
    expect(toSafeCell("@SUM(A1)")).toBe("SUM(A1)");
  });

  it("reads a semicolon file even when a quoted cell holds a comma", () => {
    const { people, problems } = parseInvitesCsv('"Lovelace, Ada";ada@example.com;Engines\n"Hopper, Grace";grace@example.com;Navy');

    expect(problems).toEqual([]);
    expect(people.map(({ name, email }) => [name, email])).toEqual([
      ["Lovelace, Ada", "ada@example.com"],
      ["Hopper, Grace", "grace@example.com"],
    ]);
  });

  it("numbers lines in a file that ends lines with a carriage return alone", () => {
    const { people } = parseInvitesCsv("name,email\rAda,ada@example.com\rBob,bob@example.com");

    expect(people.map(({ line }) => line)).toEqual([2, 3]);
  });

  it("names the line where a quote mark never closes", () => {
    const { problems } = parseInvitesCsv('name,email\nAda,ada@example.com\n"Bob,bob@example.com\nCy,cy@example.com');

    expect(problems[0]).toMatchObject({ line: 3, why: expect.stringContaining("never closes") });
  });

  it("refuses more than 20,000 rows", () => {
    const rows = ["email", ...Array.from({ length: 20_001 }, (_, index) => `p${index}@example.com`)].join("\n");

    expect(() => parseInvitesCsv(rows)).toThrow(/at most 20,000/);
  });

  it("writes a download that can't run as a formula", () => {
    expect(toCsv([["=1+1", "-2", "plain"]])).toBe(`"'=1+1","'-2","plain"`);
  });
});

describe("inviting many people", () => {
  const database = createTestDatabase();
  let admin: Member;

  beforeEach(async () => {
    await clearDatabase(database);
    admin = await createSignedInMember(database, "admin");
  });

  it("invites 50 founders from a CSV with one bad row and one duplicate", async () => {
    const response = await postBulk(bulkRequest(admin, "csv", founderCsv()));
    const result = bulkInviteResultSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(result.invitedCount).toBe(50);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatchObject({ line: 52, text: "not-an-email" });
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({ line: 53, email: "founder7@example.com" });
    expect(await database.select().from(invite)).toHaveLength(50);
    expect(await database.select().from(adminAuditEntry)).toHaveLength(50);
    // Email is off here, so the admin gets the links to send.
    expect(result.links).toHaveLength(50);
  });

  it("works from a pasted list in all three formats, and starts the join form with the name", async () => {
    const response = await postBulk(bulkRequest(admin, "list", "Ada Lovelace, ada@example.com\nGrace Hopper <grace@example.com>\nlin@example.com"));
    const result = bulkInviteResultSchema.parse(await response.json());

    expect(result.invitedCount).toBe(3);
    const grace = result.links.find(({ email }) => email === "grace@example.com");
    const lookup = await readInviteByToken(database, readInviteToken(grace?.link));
    expect(lookup?.inviteeName).toBe("Grace Hopper");
  });

  it("skips members and pending invites, and names them", async () => {
    await postBulk(bulkRequest(admin, "list", "ada@example.com"));

    const response = await postBulk(bulkRequest(admin, "list", `ada@example.com\n${admin.email}\nnew@example.com`));
    const result = bulkInviteResultSchema.parse(await response.json());

    expect(result.invitedCount).toBe(1);
    expect(result.skipped.map(({ email, why }) => [email, why.split(".")[0]])).toEqual([
      ["ada@example.com", "Already has a pending invite"],
      [admin.email, "Already a member"],
    ]);
  });

  it("puts the company and cohort from the CSV on the new member's card", async () => {
    const response = await postBulk(bulkRequest(admin, "csv", "name,email,company,cohort\nAda,ada@example.com,Engines Ltd,Fund II"));
    const [link] = bulkInviteResultSchema.parse(await response.json()).links;

    const accepted = await acceptInvite(database, readInviteToken(link?.link), { account: { name: "Ada", password: "a-long-test-password" } });
    const [profile] = await database.select().from(memberProfile).where(eq(memberProfile.userId, accepted?.userId ?? ""));
    expect(profile?.company).toBe("Engines Ltd");
    expect(profile?.cohort).toBe("Fund II");
  });

  it("is for admins only", async () => {
    const member = await createSignedInMember(database);

    expect((await postBulk(bulkRequest(member, "list", "ada@example.com"))).status).toBe(403);
  });
});

describe("inviting many people with email on", () => {
  const database = createTestDatabase();
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let admin: Member;

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
    resend.reset();
    admin = await createSignedInMember(database, "admin");
  });

  it("queues each invite's email with its invite, and the outbox sends them", async () => {
    const response = await postBulk(bulkRequest(admin, "list", "Ada, ada@example.com\nGrace <grace@example.com>\nlin@example.com"));
    const result = bulkInviteResultSchema.parse(await response.json());

    expect(result.invitedCount).toBe(3);
    expect(result.links).toEqual([]);
    const invites = await database.select().from(invite);
    const queued = await database.select().from(emailOutbox);
    expect(queued.map(({ toEmail }) => toEmail).sort()).toEqual(["ada@example.com", "grace@example.com", "lin@example.com"]);
    expect(invites.map(({ emailOutboxId }) => emailOutboxId).sort()).toEqual(queued.map(({ id }) => id).sort());

    await sendDueEmails(database, process.env);
    await vi.waitFor(() => expect(resend.state.emails).toHaveLength(3), EVENTUALLY);
  });
});
