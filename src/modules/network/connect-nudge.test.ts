import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { memberNetwork } from "@/modules/members/schema";
import { EMAIL_KINDS, EMAIL_TOPICS } from "@/platform/email/kinds";
import { emailOutbox } from "@/platform/email/schema";
import { setEmailTopic } from "@/platform/email/unsubscribe";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY } from "@/test/fake-resend-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postNudge } from "@/app/api/admin/village/nudge/route";

import { memberConnectNudge } from "./schema";
import { readConnectMeter } from "./service-nudge";

const APP_URL = "http://localhost:3000";
const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_ENVIRONMENT = { RESEND_API_KEY: FAKE_RESEND_API_KEY, RESEND_FROM_ADDRESS: "Northwind <hello@example.com>", RESEND_API_URL: "http://127.0.0.1:9" };

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function post(member: Member) {
  return new Request(`${APP_URL}/api/admin/village/nudge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
    body: "{}",
  });
}

describe("reminding members to connect", () => {
  const database = createTestDatabase();
  const savedEnvironment = { ...process.env };

  beforeEach(async () => {
    await clearDatabase(database);
    Object.assign(process.env, EMAIL_ENVIRONMENT);
  });

  afterEach(() => {
    for (const key of Object.keys(EMAIL_ENVIRONMENT)) {
      if (savedEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnvironment[key];
    }
  });

  async function readNudgeEmails() {
    return database.select().from(emailOutbox).where(eq(emailOutbox.kind, EMAIL_KINDS.connectNudge));
  }

  it("reminds each unconnected member once, then not again for 30 days", async () => {
    const admin = await createSignedInMember(database, "admin");
    const unconnected = await createSignedInMember(database);
    const connected = await createSignedInMember(database);
    await database.insert(memberNetwork).values({ userId: connected.userId, linkedinSlug: "connected-member", groupJoinedAt: new Date() });

    const [first, second] = await Promise.all([postNudge(post(admin)), postNudge(post(admin))]);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect((await readNudgeEmails()).map(({ toEmail }) => toEmail)).toEqual([unconnected.email]);

    await postNudge(post(admin));
    expect(await readNudgeEmails()).toHaveLength(1);

    await database.update(memberConnectNudge).set({ lastSentAt: new Date(Date.now() - 31 * DAY_MS) });
    await postNudge(post(admin));
    expect(await readNudgeEmails()).toHaveLength(2);
  });

  it("skips a member who turned network reminders off", async () => {
    const admin = await createSignedInMember(database, "admin");
    const member = await createSignedInMember(database);
    await setEmailTopic(database, { memberId: member.userId, topic: EMAIL_TOPICS.network }, false);

    await postNudge(post(admin));

    expect(await readNudgeEmails()).toEqual([]);
  });

  it("is for admins only", async () => {
    const member = await createSignedInMember(database);
    expect((await postNudge(post(member))).status).toBe(403);
  });

  it("counts members who are connected and open to intro asks", async () => {
    const admin = await createSignedInMember(database, "admin");
    const askable = await createSignedInMember(database);
    const awaitingApproval = await createSignedInMember(database);
    await createSignedInMember(database);
    await database.insert(memberNetwork).values([
      { userId: askable.userId, linkedinSlug: "askable", groupJoinedAt: new Date() },
      { userId: awaitingApproval.userId, linkedinSlug: "waiting", groupJoinedAt: new Date(), pendingVillageEmail: "other@example.com" },
    ]);

    expect(await readConnectMeter(database, admin.userId)).toEqual({ memberCount: 4, connectedCount: 1, unconnectedCount: 2, nudgeableCount: 1 });
  });
});
