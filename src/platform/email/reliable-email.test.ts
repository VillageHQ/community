import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { user } from "@/platform/database/auth-schema";
import { createRequestContext } from "@/platform/http/request-context";
import { acceptInvite, createInvite, readInvites, revokeInvite } from "@/modules/members/service-invites";
import { sendMessage } from "@/modules/messages/service";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { seedMember } from "@/test/members";
import { seedConversation } from "@/test/messages";
import { EMAIL_KINDS, EMAIL_TOPICS } from "./kinds";
import { OUTBOX_STATUSES, queueEmail } from "./outbox";
import { MAXIMUM_SEND_ATTEMPTS, sendDueEmails } from "./outbox-sender";
import { readGivenUpEmails } from "./outbox-reads";
import { isResendWebhookSigned, readSuppressedAddresses, signResendWebhook, suppressEmails } from "./resend-webhook";
import { emailOutbox, emailSuppression } from "./schema";
import { readUnsubscribeToken, setEmailTopic } from "./unsubscribe";
import { JOB_OUTCOMES, runJob } from "../jobs/runner";

const APP_URL = "http://localhost:3000";
const UNREACHABLE_URL = "http://127.0.0.1:9";
const EVENTUALLY = { timeout: 5_000, interval: 50 };
const WEBHOOK_SECRET = `whsec_${Buffer.from("a-webhook-secret-for-tests-only").toString("base64")}`;

type RecordedBody = { to: string[]; subject: string; text: string; headers?: Record<string, string> };

describe("reliable email", () => {
  const database = createTestDatabase();
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;

  function readEnvironment(apiUrl = resend.url) {
    return {
      APP_URL,
      BETTER_AUTH_SECRET: "a-test-auth-secret-with-at-least-32-characters",
      RESEND_API_KEY: FAKE_RESEND_API_KEY,
      RESEND_FROM_ADDRESS: "Northwind <hello@example.com>",
      RESEND_API_URL: apiUrl,
    };
  }

  function readBodies() {
    return resend.state.emails.map(({ body }) => body as RecordedBody);
  }

  async function makeDue() {
    await database.update(emailOutbox).set({ nextAttemptAt: sql`now() - interval '1 second'` });
  }

  async function readRows() {
    return database.select().from(emailOutbox);
  }

  function queueTo(memberId: string | null, kind: (typeof EMAIL_KINDS)[keyof typeof EMAIL_KINDS] = EMAIL_KINDS.introAsked, to = "amara@example.com") {
    return queueEmail(database, readEnvironment(), { kind, to, memberId, subject: "Hello", html: "<p>Hello</p>", text: "Hello" });
  }

  beforeAll(async () => {
    resend = await startFakeResendServer();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    resend.reset();
  });

  afterAll(async () => {
    await resend.stop();
    await database.$client.end();
  });

  describe("the outbox", () => {
    it("keeps an invite while Resend is down and sends it once when it's back", async () => {
      const adminId = await seedMember(database, { name: "Priya Raman" });
      await database.update(user).set({ role: "admin" }).where(eq(user.id, adminId));
      const context = createRequestContext(database, readEnvironment(UNREACHABLE_URL), { id: adminId, email: "priya@example.com", role: "admin" });

      const issued = await createInvite(context, "amara@example.com");
      expect(issued.invite.emailStatus).toBe("retrying");
      expect((await readRows()).map(({ status }) => status)).toEqual([OUTBOX_STATUSES.pending]);

      await makeDue();
      await Promise.all([sendDueEmails(database, readEnvironment()), sendDueEmails(database, readEnvironment())]);
      await makeDue();
      await sendDueEmails(database, readEnvironment());

      expect(readBodies().map(({ to }) => to)).toEqual([["amara@example.com"]]);
      const [row] = await readRows();
      expect(row?.status).toBe(OUTBOX_STATUSES.sent);
      expect(resend.state.emails[0]?.idempotencyKey).toBe(row?.id);
      expect(row?.html).toBe("");
    });

    it("shows the invite's live email status, and stops a revoked invite's queued email", async () => {
      const adminId = await seedMember(database, { name: "Priya Raman" });
      await database.update(user).set({ role: "admin" }).where(eq(user.id, adminId));
      const admin = { id: adminId, email: "priya@example.com", role: "admin" };
      const downContext = createRequestContext(database, readEnvironment(UNREACHABLE_URL), admin);
      const kept = await createInvite(downContext, "kept@example.com");
      const revoked = await createInvite(downContext, "revoked@example.com");
      await revokeInvite(downContext, revoked.invite.id);

      await makeDue();
      await sendDueEmails(database, readEnvironment());

      expect(readBodies().map(({ to }) => to)).toEqual([["kept@example.com"]]);
      const { invites } = await readInvites(database, 1);
      expect(invites.find(({ id }) => id === kept.invite.id)?.emailStatus).toBe("sent");
    });

    it("never sends an invite email once its link was used, or after a revoke during a failing try", async () => {
      const adminId = await seedMember(database, { name: "Priya Raman" });
      await database.update(user).set({ role: "admin" }).where(eq(user.id, adminId));
      const downContext = createRequestContext(database, readEnvironment(UNREACHABLE_URL), { id: adminId, email: "priya@example.com", role: "admin" });
      const accepted = await createInvite(downContext, "accepted@example.com");
      const inFlight = await createInvite(downContext, "in-flight@example.com");
      await acceptInvite(database, accepted.link.split("/").at(-1) ?? "", {
        name: "Ama Mensah",
        password: "a-long-enough-password",
      });
      // As if a sender had claimed it and its try was still hanging when the admin revoked.
      await database.update(emailOutbox).set({ status: OUTBOX_STATUSES.sending }).where(eq(emailOutbox.toEmail, "in-flight@example.com"));
      await revokeInvite(downContext, inFlight.invite.id);

      await makeDue();
      await sendDueEmails(database, readEnvironment());

      expect(readBodies()).toEqual([]);
      expect((await readRows()).map(({ status }) => status)).toEqual([OUTBOX_STATUSES.skipped, OUTBOX_STATUSES.skipped]);
    });

    it("sends each email once when two senders run at once", async () => {
      for (let index = 0; index < 30; index += 1) await queueTo(null, EMAIL_KINDS.invite, `person${index}@example.com`);

      await Promise.all([sendDueEmails(database, readEnvironment()), sendDueEmails(database, readEnvironment()), sendDueEmails(database, readEnvironment())]);

      const recipients = readBodies().flatMap(({ to }) => to);
      expect(recipients).toHaveLength(30);
      expect(new Set(recipients).size).toBe(30);
    });

    it("backs off, then gives up and tells the admin", async () => {
      resend.state.failureStatus = 503;
      await queueTo(null, EMAIL_KINDS.invite);

      for (let attempt = 0; attempt < MAXIMUM_SEND_ATTEMPTS; attempt += 1) {
        await makeDue();
        await sendDueEmails(database, readEnvironment());
        const [row] = await readRows();
        if (attempt < MAXIMUM_SEND_ATTEMPTS - 1) expect(row?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
      }

      const [row] = await readRows();
      expect(row?.status).toBe(OUTBOX_STATUSES.failed);
      expect(resend.state.emails).toHaveLength(MAXIMUM_SEND_ATTEMPTS);
      const notice = await readGivenUpEmails(database);
      expect(notice.total).toBe(1);
      expect(notice.recent[0]?.lastError).toContain("503");
    });

    it("queues nothing when email is off", async () => {
      expect(await queueEmail(database, {}, { kind: EMAIL_KINDS.invite, to: "a@example.com", memberId: null, subject: "s", html: "h", text: "t" })).toBeNull();
    });
  });

  describe("unsubscribing", () => {
    it("adds one-click headers and a link to optional email only", async () => {
      const memberId = await seedMember(database, { name: "Amara" });
      await queueTo(memberId);
      await queueTo(null, EMAIL_KINDS.invite, "new@example.com");

      await sendDueEmails(database, readEnvironment());

      const [withHeaders, withoutHeaders] = [readBodies().find(({ headers }) => headers), readBodies().find(({ headers }) => !headers)];
      expect(withHeaders?.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
      expect(withHeaders?.text).toContain("/unsubscribe?token=");
      expect(withoutHeaders?.to).toEqual(["new@example.com"]);

      const token = decodeURIComponent(withHeaders?.headers?.["List-Unsubscribe"]?.match(/token=([^>]+)/)?.[1] ?? "");
      expect(await readUnsubscribeToken(database, readEnvironment(), token)).toEqual({ memberId, topic: EMAIL_TOPICS.intros });
      expect(await readUnsubscribeToken(database, readEnvironment(), `${token}x`)).toBeNull();
    });

    it("stops that topic and no other", async () => {
      const memberId = await seedMember(database, { name: "Amara" });
      await setEmailTopic(database, { memberId, topic: EMAIL_TOPICS.intros }, false);

      expect(await queueTo(memberId, EMAIL_KINDS.introUpdate)).toBeNull();
      expect(await queueTo(memberId, EMAIL_KINDS.directMessage)).not.toBeNull();
      expect(await queueTo(memberId, EMAIL_KINDS.passwordReset)).not.toBeNull();
    });

    it("skips an email queued before the member turned the topic off", async () => {
      const memberId = await seedMember(database, { name: "Amara" });
      await queueTo(memberId);
      await setEmailTopic(database, { memberId, topic: EMAIL_TOPICS.intros }, false);

      await sendDueEmails(database, readEnvironment());

      expect(resend.state.emails).toEqual([]);
      expect((await readRows())[0]?.status).toBe(OUTBOX_STATUSES.skipped);
    });
  });

  describe("the Resend webhook", () => {
    const body = JSON.stringify({ type: "email.bounced", data: { to: ["Bounced@Example.com"] } });

    it("accepts only a fresh, correct signature", () => {
      const now = Date.now();
      const timestamp = String(Math.floor(now / 1000));
      const signature = `v1,${signResendWebhook(WEBHOOK_SECRET, "msg_1", timestamp, body)}`;

      expect(isResendWebhookSigned(WEBHOOK_SECRET, { id: "msg_1", timestamp, signature, body }, now)).toBe(true);
      expect(isResendWebhookSigned(WEBHOOK_SECRET, { id: "msg_1", timestamp, signature, body: `${body} ` }, now)).toBe(false);
      expect(isResendWebhookSigned(WEBHOOK_SECRET, { id: "msg_1", timestamp, signature, body }, now + 10 * 60_000)).toBe(false);
      expect(isResendWebhookSigned(WEBHOOK_SECRET, { id: "msg_1", timestamp, signature: null, body }, now)).toBe(false);
    });

    it("puts a bounced address on the do-not-send list, which stops optional email to it", async () => {
      const event = readSuppressedAddresses(body);
      await suppressEmails(database, event?.emails ?? [], event?.reason ?? "");
      const memberId = await seedMember(database, { name: "Amara" });

      expect(await database.select({ email: emailSuppression.email }).from(emailSuppression)).toEqual([{ email: "bounced@example.com" }]);
      expect(await queueTo(memberId, EMAIL_KINDS.introAsked, "bounced@example.com")).toBeNull();
      expect(await queueTo(memberId, EMAIL_KINDS.passwordReset, "bounced@example.com")).not.toBeNull();
    });
  });

  describe("direct message email", () => {
    it("sends one email for a burst of messages in the same conversation", async () => {
      const senderId = await seedMember(database, { name: "Jonas" });
      const recipientId = await seedMember(database, { name: "Amara" });
      const conversationId = await seedConversation(database, senderId, recipientId);
      const context = createRequestContext(database, readEnvironment(), { id: senderId, email: "jonas@example.com" });

      await sendMessage(context, { conversationId, clientKey: randomUUID(), body: "Hi there" }, async () => true);
      await vi.waitFor(() => expect(resend.state.emails).toHaveLength(1), EVENTUALLY);
      await sendMessage(context, { conversationId, clientKey: randomUUID(), body: "One more thing" }, async () => true);

      expect(await readRows()).toHaveLength(1);
      expect(readBodies()[0]?.subject).toBe("Jonas sent you a message");
      expect(JSON.stringify(readBodies())).not.toContain("Hi there");
    });

    it("respects the member's switch", async () => {
      const senderId = await seedMember(database, { name: "Jonas" });
      const recipientId = await seedMember(database, { name: "Amara" });
      await setEmailTopic(database, { memberId: recipientId, topic: EMAIL_TOPICS.messages }, false);
      const conversationId = await seedConversation(database, senderId, recipientId);
      const context = createRequestContext(database, readEnvironment(), { id: senderId, email: "jonas@example.com" });

      await sendMessage(context, { conversationId, clientKey: randomUUID(), body: "Hi there" }, async () => true);

      expect(await readRows()).toEqual([]);
    });
  });

  describe("the job runner", () => {
    it("runs a job on one server at a time and waits for its interval", async () => {
      let release: () => void = () => undefined;
      const runs: number[] = [];
      const job = {
        name: "test-job",
        intervalMs: 60_000,
        run: () =>
          new Promise<void>((resolve) => {
            runs.push(Date.now());
            release = resolve;
          }),
      };
      const otherServerJob = { ...job };

      const first = runJob(database, {}, job);
      await vi.waitFor(() => expect(runs).toHaveLength(1), EVENTUALLY);
      expect(await runJob(database, {}, job)).toBe(JOB_OUTCOMES.busy);
      expect(await runJob(database, {}, { ...otherServerJob, name: "test-job" })).toBe(JOB_OUTCOMES.busy);
      release();
      expect(await first).toBe(JOB_OUTCOMES.ran);

      expect(await runJob(database, {}, job)).toBe(JOB_OUTCOMES.notDue);
      expect(runs).toHaveLength(1);
    });

    it("refuses a job whose lease another server holds", async () => {
      await database.execute(sql`insert into job_lease (name, holder, leased_until) values ('held-job', 'other-server', now() + interval '5 minutes')`);

      expect(await runJob(database, {}, { name: "held-job", intervalMs: 1_000, run: async () => undefined })).toBe(JOB_OUTCOMES.notDue);
    });
  });
});
