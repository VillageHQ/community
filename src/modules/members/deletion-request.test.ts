import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postDeletionRequest } from "@/app/api/profile/deletion-request/route";
import { renderDeletionRequestEmail } from "@/modules/members/email-deletion-request";
import { memberDeletionRequest } from "@/modules/members/schema";
import { user } from "@/platform/database/auth-schema";
import { EMAIL_KINDS } from "@/platform/email/kinds";
import { emailOutbox } from "@/platform/email/schema";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function askToDelete(member: Member) {
  return postDeletionRequest(
    new Request(`${APP_URL}/api/profile/deletion-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
      body: "{}",
    }),
  );
}

describe("Ask to delete my account", () => {
  const database = createTestDatabase();
  let firstAdmin: Member;
  let secondAdmin: Member;
  let member: Member;

  beforeEach(async () => {
    await clearDatabase(database);
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_FROM_ADDRESS", "community@example.com");
    firstAdmin = await createSignedInMember(database, "admin");
    secondAdmin = await createSignedInMember(database, "admin");
    member = await createSignedInMember(database);
    await database.update(user).set({ name: "Sam Lee" }).where(eq(user.id, member.userId));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await database.$client.end();
  });

  it("saves the request and queues one email to each admin, once", async () => {
    expect((await askToDelete(member)).status).toBe(OK_STATUS);
    expect((await askToDelete(member)).status).toBe(OK_STATUS);

    expect(await database.select().from(memberDeletionRequest)).toHaveLength(1);
    const emails = await database.select().from(emailOutbox).where(eq(emailOutbox.kind, EMAIL_KINDS.deletionRequest));
    expect(emails.map(({ memberId }) => memberId).toSorted()).toEqual([firstAdmin.userId, secondAdmin.userId].toSorted());
    expect(emails[0]?.subject).toBe("Sam Lee asked to delete their account");
    expect(emails[0]?.text).toContain(`${APP_URL}/admin/members?f=delete`);
  });

  it("never emails the admin who asks about their own account", async () => {
    await askToDelete(firstAdmin);

    const emails = await database.select().from(emailOutbox).where(eq(emailOutbox.kind, EMAIL_KINDS.deletionRequest));
    expect(emails.map(({ memberId }) => memberId)).toEqual([secondAdmin.userId]);
  });
});

describe("the email to the admins", () => {
  it("says what Founderhall's says, word for word", () => {
    const { subject, text } = renderDeletionRequestEmail({
      memberName: "Sam Lee",
      memberEmail: "sam.lee@example.com",
      communityName: "Northwind Founders",
      membersLink: "https://community.example/admin/members?f=delete",
    });

    expect(subject).toBe("Sam Lee asked to delete their account");
    expect(text).toBe(
      [
        "Hi,",
        "Sam Lee (sam.lee@example.com) asked Northwind Founders to delete their account, from the Your data page.",
        "See them in Members: https://community.example/admin/members?f=delete",
        "Sent by Northwind Founders via its member portal.",
      ].join("\n\n"),
    );
  });
});
