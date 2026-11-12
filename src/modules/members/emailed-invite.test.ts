import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { POST as postCreate } from "@/app/api/admin/invites/route";
import { POST as postAccept } from "@/app/api/invites/accept/route";
import { POST as postNotMe } from "@/app/api/invites/not-me/route";
import { readWaitingMembers } from "@/modules/members/service-admin";
import { issuedInviteSchema } from "@/modules/members/contract-invites";
import { account, session, user } from "@/platform/database/auth-schema";
import { EMAIL_KINDS } from "@/platform/email/kinds";
import { emailOutbox } from "@/platform/email/schema";
import { adminAuditEntry } from "@/platform/audit/schema";
import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { invite } from "@/modules/members/schema";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { readInviteToken } from "@/test/invite-link";
import { createSignedInMember } from "@/test/signed-in-member";

// The owner's call (2026-11-12): opening the invite link that was EMAILED confirms the address, with no second
// "Confirm your email". A copied link (or one with a made-up mark) still asks.
const APP_URL = "http://localhost:3000";
const INVITEE = "nadia.cole@example.com";
const CREATED_STATUS = 201;
const NOT_ME_PATTERN = /(http:\/\/localhost:3000\/invite\/not-me\?m=[A-Za-z0-9_-]+&s=[A-Za-z0-9_-]+)/;
const LINK_PATTERN = /(http:\/\/localhost:3000\/invite\?token=[A-Za-z0-9_-]+&e=[A-Za-z0-9_-]+)/;

describe("joining from the emailed invite link", () => {
  const database = createTestDatabase();
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let copiedLink: string;

  beforeAll(async () => {
    resend = await startFakeResendServer();
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.test>");
    vi.stubEnv("RESEND_API_URL", resend.url);
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-with-at-least-32-characters");
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await resend.stop();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    resend.reset();
    const admin = await createSignedInMember(database, "admin");
    const response = await postCreate(
      new Request(`${APP_URL}/api/admin/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: admin.cookie },
        body: JSON.stringify({ email: INVITEE }),
      }),
    );
    copiedLink = issuedInviteSchema.parse(await response.json()).link;
  });

  function readEmailedLink() {
    const sent = resend.state.emails.find((email) => JSON.stringify(email.body).includes(INVITEE));
    return new URL(z.string().parse(JSON.stringify(sent?.body).match(LINK_PATTERN)?.[1]));
  }

  function accept(body: Record<string, string>) {
    return postAccept(
      new Request(`${APP_URL}/api/invites/accept`, { method: "POST", headers: { "Content-Type": "application/json", Origin: APP_URL }, body: JSON.stringify(body) }),
    );
  }

  async function readJoined() {
    const [joined] = await database.select({ emailVerified: user.emailVerified }).from(user).where(eq(user.email, INVITEE));
    return joined;
  }

  async function countConfirmationEmails() {
    return (await database.select({ id: emailOutbox.id }).from(emailOutbox).where(eq(emailOutbox.kind, EMAIL_KINDS.emailConfirmation))).length;
  }

  it("emails a link with a mark that the copied link doesn't have", () => {
    const emailed = readEmailedLink();

    expect(emailed.searchParams.get("token")).toBe(readInviteToken(copiedLink));
    expect(emailed.searchParams.get("e")).toBeTruthy();
    expect(new URL(copiedLink).searchParams.has("e")).toBe(false);
  });

  it("confirms the address and sends no confirmation email for the emailed link", async () => {
    const emailed = readEmailedLink();

    const response = await accept({ token: z.string().parse(emailed.searchParams.get("token")), emailed: z.string().parse(emailed.searchParams.get("e")) });

    expect(response.status).toBe(CREATED_STATUS);
    expect(await response.json()).toEqual({ isSignedIn: true });
    expect((await readJoined())?.emailVerified).toBe(true);
    expect(await countConfirmationEmails()).toBe(0);
  });

  it("still asks for confirmation from a copied link", async () => {
    const response = await accept({ token: readInviteToken(copiedLink) });

    expect(response.status).toBe(CREATED_STATUS);
    expect((await readJoined())?.emailVerified).toBe(false);
    expect(await countConfirmationEmails()).toBe(1);
  });

  it("treats a made-up mark as a copied link", async () => {
    const response = await accept({ token: readInviteToken(copiedLink), emailed: "A".repeat(43) });

    expect(response.status).toBe(CREATED_STATUS);
    expect((await readJoined())?.emailVerified).toBe(false);
    expect(await countConfirmationEmails()).toBe(1);
  });

  // INV-09: someone else holding the forwarded email could join as this address. The real owner hears about it.
  describe("when the emailed link is used", () => {
    async function joinFromEmail() {
      const emailed = readEmailedLink();
      await accept({ token: z.string().parse(emailed.searchParams.get("token")), emailed: z.string().parse(emailed.searchParams.get("e")) });
    }

    async function readNotice() {
      const [notice] = await database.select().from(emailOutbox).where(eq(emailOutbox.kind, EMAIL_KINDS.inviteUsed));
      return notice;
    }

    function notMe(link: URL) {
      return postNotMe(
        new Request(`${APP_URL}/api/invites/not-me`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: APP_URL },
          body: JSON.stringify({ member: link.searchParams.get("m"), signature: link.searchParams.get("s") }),
        }),
      );
    }

    // A sent email's words leave the outbox, so the link is read from what the fake Resend received.
    function readNotMeLink() {
      const sent = resend.state.emails.find((email) => JSON.stringify(email.body).includes("/invite/not-me"));
      return new URL(z.string().parse(JSON.stringify(sent?.body).match(NOT_ME_PATTERN)?.[1]));
    }

    it("tells the invited address, with a link for when it wasn't them", async () => {
      await joinFromEmail();

      const notice = await readNotice();
      expect(notice?.toEmail).toBe(INVITEE);
      expect(readNotMeLink().pathname).toBe("/invite/not-me");
    });

    it("sends no notice for a copied link, which asks for confirmation instead", async () => {
      await accept({ token: readInviteToken(copiedLink) });

      expect(await readNotice()).toBeUndefined();
    });

    it("signs out whoever joined and puts them on the admin's waiting list when the owner says it wasn't them", async () => {
      await joinFromEmail();
      const [joined] = await database.select({ id: user.id }).from(user).where(eq(user.email, INVITEE));
      const joinedId = z.string().parse(joined?.id);
      await database.insert(account).values({ id: crypto.randomUUID(), userId: joinedId, accountId: joinedId, providerId: "credential", password: "x" });

      const response = await notMe(readNotMeLink());

      expect(response.status).toBe(200);
      expect((await readJoined())?.emailVerified).toBe(false);
      expect(await database.select().from(session).where(eq(session.userId, joinedId))).toHaveLength(0);
      expect(await database.select().from(account).where(eq(account.userId, joinedId))).toHaveLength(0);
      const waiting = await readWaitingMembers(database);
      expect(waiting.find(({ id }) => id === joinedId)?.isReportedNotThem).toBe(true);
    });

    it("does the same once when pressed twice", async () => {
      await joinFromEmail();
      const link = readNotMeLink();

      expect((await notMe(link)).status).toBe(200);
      expect((await notMe(link)).status).toBe(200);
      expect(await database.select().from(adminAuditEntry).where(eq(adminAuditEntry.action, AUDIT_ACTIONS.inviteReportedNotMe))).toHaveLength(1);
    });

    it("stops working once an invite's lifetime has passed since the join", async () => {
      await joinFromEmail();
      await database.update(invite).set({ acceptedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }).where(eq(invite.email, INVITEE));

      expect((await notMe(readNotMeLink())).status).toBe(404);
    });

    it("refuses a changed signature", async () => {
      await joinFromEmail();
      const link = readNotMeLink();
      link.searchParams.set("s", "A".repeat(43));

      const response = await notMe(link);

      expect(response.status).toBe(404);
      expect((await readJoined())?.emailVerified).toBe(true);
    });
  });
});
