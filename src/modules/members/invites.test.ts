import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { user } from "@/platform/database/auth-schema";
import { invite } from "@/modules/members/schema";
import { readSetupProgress, SETUP_STEPS } from "@/shell/admin-setup";
import { inviteListSchema, issuedInviteSchema } from "@/modules/members/contract-invites";
import { INVITE_EMAIL_STATUSES, INVITE_STATES } from "@/modules/members/contract-invite-state";
import { hashInviteToken } from "@/modules/members/service-invite-token";
import { readInviteByToken } from "@/modules/members/service-invites";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postList } from "@/app/api/admin/invites/list/route";
import { POST as postResend } from "@/app/api/admin/invites/resend/route";
import { POST as postRevoke } from "@/app/api/admin/invites/revoke/route";
import { POST as postCreate } from "@/app/api/admin/invites/route";
import { readInviteToken } from "@/test/invite-link";

const APP_URL = "http://localhost:3000";
const INVITEE = "amara@tidewell.example";
const CREATED_STATUS = 201;
const OK_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function jsonRequest(member: Member | null, body: unknown, origin = APP_URL) {
  return new Request(`${APP_URL}/api/admin/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, ...(member ? { Cookie: member.cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function readToken(link: string) {
  return z.string().parse(readInviteToken(link));
}

describe("admin invites", () => {
  const database = createTestDatabase();
  let admin: Member;
  let member: Member;

  async function createInviteAs(requester: Member, email = INVITEE) {
    const response = await postCreate(jsonRequest(requester, { email }));
    return issuedInviteSchema.parse(await response.json());
  }

  async function readRow(inviteId: string) {
    const [row] = await database.select().from(invite).where(eq(invite.id, inviteId));
    if (!row) throw new Error("The invite row is missing.");
    return row;
  }

  async function expireInvite(inviteId: string) {
    await database.update(invite).set({ expiresAt: new Date(Date.now() - 1_000) }).where(eq(invite.id, inviteId));
  }

  beforeEach(async () => {
    await clearDatabase(database);
    admin = await createSignedInMember(database, "admin");
    member = await createSignedInMember(database);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("creating an invite", () => {
    it("returns a link for that person", async () => {
      const response = await postCreate(jsonRequest(admin, { email: INVITEE }));
      const issued = issuedInviteSchema.parse(await response.json());

      expect(response.status).toBe(CREATED_STATUS);
      expect(issued.link).toMatch(new RegExp(`^${APP_URL}/invite\\?token=[A-Za-z0-9_-]{43}$`));
      expect(issued.invite).toMatchObject({ email: INVITEE, state: INVITE_STATES.pending });
    });

    it("keeps an optional cohort for the new member's card", async () => {
      const withCohort = await postCreate(jsonRequest(admin, { email: INVITEE, cohort: "  Fund II " }));
      const without = await postCreate(jsonRequest(admin, { email: "jonas@tidewell.example", cohort: "" }));

      expect((await readRow(issuedInviteSchema.parse(await withCohort.json()).invite.id)).cohort).toBe("Fund II");
      expect((await readRow(issuedInviteSchema.parse(await without.json()).invite.id)).cohort).toBeNull();
    });

    it("refuses a cohort that is too long", async () => {
      const response = await postCreate(jsonRequest(admin, { email: INVITEE, cohort: "x".repeat(81) }));

      expect(response.status).toBe(422);
    });

    it("stores only a hash of the token", async () => {
      const issued = await createInviteAs(admin);
      const token = readToken(issued.link);
      const row = await readRow(issued.invite.id);

      expect(row.tokenHash).toBe(hashInviteToken(token));
      expect(JSON.stringify(row)).not.toContain(token);
    });

    it("lowercases the email", async () => {
      const issued = await createInviteAs(admin, "  Amara@Tidewell.Example ");

      expect(issued.invite.email).toBe(INVITEE);
    });

    it("records who invited them", async () => {
      await database.update(user).set({ name: "Priya Raman" }).where(eq(user.id, admin.userId));

      const issued = await createInviteAs(admin);

      expect(issued.invite.invitedByName).toBe("Priya Raman");
    });

    it("refuses an invalid email", async () => {
      const response = await postCreate(jsonRequest(admin, { email: "not-an-email" }));

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
    });

    it("tells the admin when this person already has an account", async () => {
      const response = await postCreate(jsonRequest(admin, { email: member.email }));

      expect(response.status).toBe(CONFLICT_STATUS);
      expect(await database.select().from(invite)).toEqual([]);
    });

    it("refuses a second open invite for the same email", async () => {
      await createInviteAs(admin);

      const response = await postCreate(jsonRequest(admin, { email: INVITEE }));

      expect(response.status).toBe(CONFLICT_STATUS);
      expect(await database.select().from(invite)).toHaveLength(1);
    });

    it("keeps one open invite when two admins invite the same email at once", async () => {
      const responses = await Promise.all([
        postCreate(jsonRequest(admin, { email: INVITEE })),
        postCreate(jsonRequest(admin, { email: INVITEE })),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([CREATED_STATUS, CONFLICT_STATUS]);
      expect(await database.select().from(invite)).toHaveLength(1);
    });

    it("renews an expired invite instead of adding a second row", async () => {
      const first = await createInviteAs(admin);
      await expireInvite(first.invite.id);

      const renewed = await createInviteAs(admin);

      expect(renewed.invite.id).toBe(first.invite.id);
      expect(renewed.invite.state).toBe(INVITE_STATES.pending);
    });

    it("allows a new invite after a revoked one", async () => {
      const first = await createInviteAs(admin);
      await postRevoke(jsonRequest(admin, { inviteId: first.invite.id }));

      const second = await createInviteAs(admin);

      expect(second.invite.id).not.toBe(first.invite.id);
    });
  });

  describe("who can manage invites", () => {
    it.each([
      ["create", postCreate, { email: INVITEE }],
      ["list", postList, {}],
    ])("refuses a member who isn't an admin on %s", async (_name, post, body) => {
      const response = await post(jsonRequest(member, body));

      expect(response.status).toBe(FORBIDDEN_STATUS);
    });

    it("refuses a member who tries to resend or revoke", async () => {
      const { invite: created } = await createInviteAs(admin);

      const resend = await postResend(jsonRequest(member, { inviteId: created.id }));
      const revoke = await postRevoke(jsonRequest(member, { inviteId: created.id }));

      expect(resend.status).toBe(FORBIDDEN_STATUS);
      expect(revoke.status).toBe(FORBIDDEN_STATUS);
      expect((await readRow(created.id)).revokedAt).toBeNull();
    });

    it("refuses a visitor", async () => {
      expect((await postCreate(jsonRequest(null, { email: INVITEE }))).status).toBe(UNAUTHORIZED_STATUS);
    });

    it("refuses another site's origin", async () => {
      const response = await postCreate(jsonRequest(admin, { email: INVITEE }, "https://evil.test"));

      expect(response.status).toBe(FORBIDDEN_STATUS);
      expect(await database.select().from(invite)).toEqual([]);
    });
  });

  describe("resending", () => {
    it("issues a new link and kills the old one, because only a hash is stored", async () => {
      const first = await createInviteAs(admin);

      const response = await postResend(jsonRequest(admin, { inviteId: first.invite.id }));
      const second = issuedInviteSchema.parse(await response.json());

      expect(second.link).not.toBe(first.link);
      expect(await readInviteByToken(database, readToken(first.link))).toBeNull();
      expect((await readInviteByToken(database, readToken(second.link)))?.state).toBe(INVITE_STATES.pending);
    });

    it("extends an expired invite", async () => {
      const first = await createInviteAs(admin);
      await expireInvite(first.invite.id);

      const response = await postResend(jsonRequest(admin, { inviteId: first.invite.id }));
      const second = issuedInviteSchema.parse(await response.json());

      expect(second.invite.state).toBe(INVITE_STATES.pending);
    });

    it("refuses a revoked invite", async () => {
      const first = await createInviteAs(admin);
      await postRevoke(jsonRequest(admin, { inviteId: first.invite.id }));

      const response = await postResend(jsonRequest(admin, { inviteId: first.invite.id }));

      expect(response.status).toBe(CONFLICT_STATUS);
    });
  });

  describe("revoking", () => {
    it("stops the link working", async () => {
      const issued = await createInviteAs(admin);

      const response = await postRevoke(jsonRequest(admin, { inviteId: issued.invite.id }));

      expect(response.status).toBe(OK_STATUS);
      expect((await readInviteByToken(database, readToken(issued.link)))?.state).toBe(INVITE_STATES.revoked);
    });

    it("answers 409 when the invite no longer exists", async () => {
      const response = await postRevoke(jsonRequest(admin, { inviteId: "018f6b1e-0000-7000-8000-000000000000" }));

      expect(response.status).toBe(CONFLICT_STATUS);
    });
  });

  describe("listing", () => {
    it("shows every state, without any token", async () => {
      const pending = await createInviteAs(admin, "pending@example.test");
      const expired = await createInviteAs(admin, "expired@example.test");
      const revoked = await createInviteAs(admin, "revoked@example.test");
      await expireInvite(expired.invite.id);
      await postRevoke(jsonRequest(admin, { inviteId: revoked.invite.id }));

      const response = await postList(jsonRequest(admin, {}));
      const text = await response.text();
      const { invites } = inviteListSchema.parse(JSON.parse(text));

      expect(new Map(invites.map(({ email, state }) => [email, state]))).toEqual(
        new Map([
          ["pending@example.test", INVITE_STATES.pending],
          ["expired@example.test", INVITE_STATES.expired],
          ["revoked@example.test", INVITE_STATES.revoked],
        ]),
      );
      expect(text).not.toContain(readToken(pending.link));
      expect(text).not.toContain((await readRow(pending.invite.id)).tokenHash);
    });

    it("pages through a long list", async () => {
      for (let position = 0; position < 11; position += 1) await createInviteAs(admin, `person-${position}@example.test`);

      const second = inviteListSchema.parse(await (await postList(jsonRequest(admin, { page: 2 }))).json());

      expect(second).toMatchObject({ page: 2, pageCount: 2, matchCount: 11 });
      expect(second.invites).toHaveLength(1);
    });
  });

  describe("the admin checklist", () => {
    it("marks the invite step done once an invite is out", async () => {
      const readStep = async () => {
        const { steps } = await readSetupProgress(database);
        return steps.find(({ id }) => id === SETUP_STEPS.invite)?.isDone;
      };

      expect(await readStep()).toBe(false);
      await createInviteAs(admin);
      expect(await readStep()).toBe(true);
    });

    it("reopens the step when the only invite is revoked", async () => {
      const issued = await createInviteAs(admin);
      await postRevoke(jsonRequest(admin, { inviteId: issued.invite.id }));

      const { steps } = await readSetupProgress(database);

      expect(steps.find(({ id }) => id === SETUP_STEPS.invite)?.isDone).toBe(false);
    });
  });

  describe("email through Resend", () => {
    let resend: Awaited<ReturnType<typeof startFakeResendServer>>;

    beforeAll(async () => {
      resend = await startFakeResendServer();
    });

    afterAll(async () => {
      await resend.stop();
    });

    beforeEach(() => {
      resend.reset();
      vi.stubEnv("RESEND_API_URL", resend.url);
    });

    function configureResend() {
      vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
      vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@northwind.example>");
    }

    it("sends nothing without a key, and the link is the whole flow", async () => {
      const issued = await createInviteAs(admin);

      expect(resend.state.emails).toEqual([]);
      expect(issued.invite.emailStatus).toBe(INVITE_EMAIL_STATUSES.notSent);
      expect(issued.link).toContain("/invite?token=");
    });

    it("sends nothing with a key but no from address", async () => {
      vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);

      await createInviteAs(admin);

      expect(resend.state.emails).toEqual([]);
    });

    it("emails the link when configured", async () => {
      configureResend();

      const issued = await createInviteAs(admin);
      const [email] = resend.state.emails;

      expect(issued.invite.emailStatus).toBe(INVITE_EMAIL_STATUSES.sent);
      expect(email?.authorization).toBe(`Bearer ${FAKE_RESEND_API_KEY}`);
      expect(email?.body).toMatchObject({ to: [INVITEE], from: "Northwind <hello@northwind.example>" });
      expect(JSON.stringify(email?.body)).toContain(issued.link);
    });

    it("keeps the invite and the link when Resend fails", async () => {
      configureResend();
      resend.state.failureStatus = 500;
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await postCreate(jsonRequest(admin, { email: INVITEE }));
      const issued = issuedInviteSchema.parse(await response.json());

      expect(response.status).toBe(CREATED_STATUS);
      expect(issued.invite.emailStatus).toBe(INVITE_EMAIL_STATUSES.retrying);
      expect((await readInviteByToken(database, readToken(issued.link)))?.state).toBe(INVITE_STATES.pending);
    });

    it("keeps the invite when Resend is unreachable", async () => {
      configureResend();
      vi.stubEnv("RESEND_API_URL", "http://127.0.0.1:9");
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const issued = await createInviteAs(admin);

      expect(issued.invite.emailStatus).toBe(INVITE_EMAIL_STATUSES.retrying);
      expect((await readRow(issued.invite.id)).acceptedAt).toBeNull();
    });

    it("sends the new link on resend, under a new idempotency key", async () => {
      configureResend();
      const first = await createInviteAs(admin);

      const response = await postResend(jsonRequest(admin, { inviteId: first.invite.id }));
      const second = issuedInviteSchema.parse(await response.json());
      const [firstEmail, secondEmail] = resend.state.emails;

      expect(JSON.stringify(secondEmail?.body)).toContain(second.link);
      expect(secondEmail?.idempotencyKey).not.toBe(firstEmail?.idempotencyKey);
    });
  });
});
