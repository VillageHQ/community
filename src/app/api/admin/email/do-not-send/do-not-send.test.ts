import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { POST as postRemove } from "@/app/api/admin/email/do-not-send/route";
import { readDoNotSendList, readEmailLog } from "@/modules/admin/reads-email";
import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { adminAuditEntry } from "@/platform/audit/schema";
import { emailOutbox, emailSuppression } from "@/platform/email/schema";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

const APP_URL = "http://localhost:3000";
const BOUNCED = "bounced@example.com";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function removeRequest(member: Member, email: string) {
  return new Request(`${APP_URL}/api/admin/email/do-not-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
    body: JSON.stringify({ email }),
  });
}

describe("Admin › Email", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
    await database.insert(emailOutbox).values({ kind: "weekly_email", toEmail: "riley@example.com", subject: "Secret subject", html: "<p>body</p>", text: "body", status: "sent" });
    await database.insert(emailSuppression).values({ email: BOUNCED, reason: "bounced" });
  });

  it("lists sent emails by who, kind, status and time, never the subject or body", async () => {
    const [email, ...rest] = await readEmailLog(database);

    expect(rest).toEqual([]);
    expect(email).toMatchObject({ toEmail: "riley@example.com", kind: "weekly_email", status: "sent" });
    expect(Object.keys(email ?? {}).sort()).toEqual(["createdAt", "finishedAt", "id", "kind", "status", "toEmail"]);
    expect(await readDoNotSendList(database)).toEqual([expect.objectContaining({ email: BOUNCED, reason: "bounced" })]);
  });

  it("takes an address off the do-not-send list and records it in the audit log", async () => {
    const admin = await createSignedInMember(database, "admin");

    const response = await postRemove(removeRequest(admin, "Bounced@Example.com"));

    expect(response.status).toBe(200);
    expect(await readDoNotSendList(database)).toEqual([]);
    const entries = await database.select().from(adminAuditEntry).where(eq(adminAuditEntry.action, AUDIT_ACTIONS.emailUnsuppressed));
    expect(entries).toEqual([expect.objectContaining({ actorId: admin.userId, detail: BOUNCED })]);
  });

  it("says when the address isn't on the list, and refuses members who aren't admins", async () => {
    const admin = await createSignedInMember(database, "admin");
    const member = await createSignedInMember(database);

    expect((await postRemove(removeRequest(admin, "nobody@example.com"))).status).toBe(404);
    expect((await postRemove(removeRequest(member, BOUNCED))).status).toBe(403);
    expect(await readDoNotSendList(database)).toHaveLength(1);
  });
});
