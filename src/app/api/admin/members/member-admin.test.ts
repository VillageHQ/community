import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session, user } from "@/database/auth-schema";
import { invite } from "@/database/members-schema";
import { memberNetwork } from "@/database/village-schema";
import { inviteListSchema, issuedInviteSchema, waitingMembersSchema } from "@/lib/invites/invite-api";
import { INVITE_STATES } from "@/lib/invites/invite-state";
import { readDirectory } from "@/lib/members/directory";
import { readConfirmationBadgeCount, readWaitingMemberCount } from "@/lib/members/member-admin";
import { readMemberProfile } from "@/lib/members/profile";
import { readNavigationBadges } from "@/lib/navigation-badges";
import { readWelcomeNeighbours, readSharingMemberCount } from "@/lib/village/network-progress";
import { readInviteByToken, readInviterOfMember } from "@/lib/invites/invites";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postInvite } from "../invites/route";
import { POST as postList } from "../invites/list/route";
import { POST as postReclaim } from "../invites/reclaim/route";
import { POST as postAccept } from "../../invites/accept/route";
import { POST as postLinkedin } from "../../network/linkedin/route";
import { POST as postClearLinkedin } from "./clear-linkedin/route";
import { POST as postConfirm } from "./confirm/route";
import { POST as postWaiting } from "./waiting/route";

const APP_URL = "http://localhost:3000";
const INVITEE = "amara@tidewell.example";
const PASSWORD = "a-long-new-password";
const OK_STATUS = 200;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const CREATED_STATUS = 201;
const SLUG = "real-owner";
const SLUG_URL = `https://www.linkedin.com/in/${SLUG}`;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function jsonRequest(cookie: string | null, body: unknown) {
  return new Request(`${APP_URL}/api/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describe("member admin", () => {
  const database = createTestDatabase();
  let admin: Member;
  let member: Member;

  async function createInvite(email = INVITEE, cookie = admin.cookie) {
    return issuedInviteSchema.parse(await (await postInvite(jsonRequest(cookie, { email }))).json());
  }

  async function accept(link: string, name = "Amara Osei") {
    const token = link.split("/").at(-1);
    const response = await postAccept(jsonRequest(null, { token, name, password: PASSWORD }));
    const cookie = response.headers.getSetCookie()[0]?.split(";")[0] ?? "";
    return { response, cookie };
  }

  async function readAccount(email = INVITEE) {
    const [account] = await database.select().from(user).where(eq(user.email, email));
    return account;
  }

  beforeEach(async () => {
    await clearDatabase(database);
    admin = await createSignedInMember(database, "admin");
    member = await createSignedInMember(database);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("waiting for approval", () => {
    it("lists someone who accepted, with their email, only to admins", async () => {
      const { link } = await createInvite();
      await accept(link);

      const { members } = waitingMembersSchema.parse(await (await postWaiting(jsonRequest(admin.cookie, {}))).json());
      const forbidden = await postWaiting(jsonRequest(member.cookie, {}));

      expect(members.map(({ email }) => email)).toEqual([INVITEE]);
      expect(forbidden.status).toBe(FORBIDDEN_STATUS);
    });

    it("shows ten at a time, and counts them all", async () => {
      for (let position = 0; position < 11; position += 1) {
        const { link } = await createInvite(`person-${position}@example.test`);
        await accept(link, `Person ${position}`);
      }

      const waiting = waitingMembersSchema.parse(await (await postWaiting(jsonRequest(admin.cookie, {}))).json());

      expect(waiting.members).toHaveLength(10);
      expect(waiting.waitingCount).toBe(11);
    });

    it("leaves out banned members and verified ones", async () => {
      const { link } = await createInvite();
      await accept(link);
      await database.update(user).set({ banned: true }).where(eq(user.email, INVITEE));

      expect(await readWaitingMemberCount(database)).toBe(0);
    });

    it("badges the Admin menu when only an admin can confirm", async () => {
      const { link } = await createInvite();
      await accept(link);

      expect(await readConfirmationBadgeCount(database, {})).toBe(1);
      const withoutEmail = await readNavigationBadges(database, { APP_URL });
      await database.update(user).set({ emailVerified: true }).where(eq(user.email, INVITEE));
      const afterConfirm = await readNavigationBadges(database, { APP_URL });
      expect(withoutEmail.admin).toBe((afterConfirm.admin ?? 0) + 1);
    });

    it("doesn't badge when the email link can do it", async () => {
      const { link } = await createInvite();
      await accept(link);

      const badge = await readConfirmationBadgeCount(database, { RESEND_API_KEY: "key", RESEND_FROM_ADDRESS: "a@b.test" });

      expect(badge).toBe(0);
    });

    it("hides the unconfirmed state from other members", async () => {
      const { link } = await createInvite();
      await accept(link);

      const directory = await readDirectory(database, { search: "Amara", tag: "", page: 1 });

      expect(JSON.stringify(directory)).not.toMatch(/verified|confirmed/i);
    });
  });

  describe("confirming a member", () => {
    it("marks the email as owned", async () => {
      const { link } = await createInvite();
      await accept(link);
      const account = await readAccount();

      const response = await postConfirm(jsonRequest(admin.cookie, { memberId: account?.id }));

      expect(response.status).toBe(OK_STATUS);
      expect((await readAccount())?.emailVerified).toBe(true);
      expect(await readWaitingMemberCount(database)).toBe(0);
    });

    it("refuses a member who isn't an admin", async () => {
      const { link } = await createInvite();
      const { cookie } = await accept(link);
      const account = await readAccount();

      const response = await postConfirm(jsonRequest(cookie, { memberId: account?.id }));

      expect(response.status).toBe(FORBIDDEN_STATUS);
      expect((await readAccount())?.emailVerified).toBe(false);
    });

    it("answers 409 for someone already confirmed", async () => {
      const response = await postConfirm(jsonRequest(admin.cookie, { memberId: member.userId }));

      expect(response.status).toBe(CONFLICT_STATUS);
    });
  });

  describe("reclaiming a wrongly used invite", () => {
    async function claimAndReclaim() {
      const issued = await createInvite();
      const { cookie } = await accept(issued.link, "Not Amara");
      const claimant = await readAccount();
      await database.insert(memberNetwork).values({ userId: claimant?.id ?? "", linkedinSlug: "squatted" });
      const response = await postReclaim(jsonRequest(admin.cookie, { inviteId: issued.invite.id }));
      return { issued, claimant, cookie, response };
    }

    it("issues a new invite the real owner can use, with the same email", async () => {
      const { response } = await claimAndReclaim();
      const replacement = issuedInviteSchema.parse(await response.json());

      const { response: accepted } = await accept(replacement.link, "Amara Osei");

      expect(replacement.invite.email).toBe(INVITEE);
      expect(accepted.status).toBe(CREATED_STATUS);
      expect((await readAccount())?.name).toBe("Amara Osei");
    });

    it("bans the claimant and signs them out", async () => {
      const { claimant } = await claimAndReclaim();
      const [account] = await database.select().from(user).where(eq(user.id, claimant?.id ?? ""));

      expect(account?.banned).toBe(true);
      expect(await database.select().from(session).where(eq(session.userId, claimant?.id ?? ""))).toEqual([]);
    });

    it("removes them from the directory and profiles", async () => {
      const { claimant } = await claimAndReclaim();

      expect(await readMemberProfile(database, claimant?.id ?? "")).toBeNull();
    });

    it("frees the LinkedIn profile they claimed", async () => {
      const { claimant } = await claimAndReclaim();
      const [network] = await database.select().from(memberNetwork).where(eq(memberNetwork.userId, claimant?.id ?? ""));

      expect(network?.linkedinSlug).toBeNull();
    });

    it("shows the old invite as revoked", async () => {
      const { issued } = await claimAndReclaim();
      const token = issued.link.split("/").at(-1) ?? "";

      expect((await readInviteByToken(database, token))?.state).toBe(INVITE_STATES.revoked);
    });

    it("refuses a member who isn't an admin", async () => {
      const issued = await createInvite();
      await accept(issued.link);

      const response = await postReclaim(jsonRequest(member.cookie, { inviteId: issued.invite.id }));

      expect(response.status).toBe(FORBIDDEN_STATUS);
      expect((await readAccount())?.banned).toBe(false);
    });

    it("refuses an invite nobody accepted", async () => {
      const issued = await createInvite();

      const response = await postReclaim(jsonRequest(admin.cookie, { inviteId: issued.invite.id }));

      expect(response.status).toBe(CONFLICT_STATUS);
    });

    it("won't lock out an admin", async () => {
      const issued = await createInvite();
      await accept(issued.link);
      await database.update(user).set({ role: "admin" }).where(eq(user.email, INVITEE));

      const response = await postReclaim(jsonRequest(admin.cookie, { inviteId: issued.invite.id }));

      expect(response.status).toBe(CONFLICT_STATUS);
      expect((await readAccount())?.banned).toBe(false);
    });
  });

  describe("clearing a LinkedIn claim", () => {
    function claim(cookie: string) {
      return postLinkedin(jsonRequest(cookie, { linkedinUrl: SLUG_URL }));
    }

    it("lets the real owner add the profile", async () => {
      await claim(member.cookie);
      const owner = await createSignedInMember(database);
      expect((await claim(owner.cookie)).status).toBe(CONFLICT_STATUS);

      const response = await postClearLinkedin(jsonRequest(admin.cookie, { linkedinUrl: SLUG_URL }));

      expect(response.status).toBe(OK_STATUS);
      expect((await claim(owner.cookie)).status).toBe(OK_STATUS);
    });

    it("refuses a member who isn't an admin", async () => {
      await claim(member.cookie);

      expect((await postClearLinkedin(jsonRequest(member.cookie, { linkedinUrl: SLUG_URL }))).status).toBe(FORBIDDEN_STATUS);
    });

    it("answers 404 when nobody holds it", async () => {
      expect((await postClearLinkedin(jsonRequest(admin.cookie, { linkedinUrl: SLUG_URL }))).status).toBe(NOT_FOUND_STATUS);
    });

    it("answers 409, not 500, when two members claim one profile at once", async () => {
      const owner = await createSignedInMember(database);

      const responses = await Promise.all([claim(member.cookie), claim(owner.cookie)]);

      expect(responses.map(({ status }) => status).sort()).toEqual([OK_STATUS, CONFLICT_STATUS]);
    });
  });

  describe("banned names", () => {
    it("drops a banned member from the welcome faces and the sharing count", async () => {
      const now = new Date();
      await database.insert(memberNetwork).values({ userId: member.userId, groupJoinedAt: now });
      await database.update(user).set({ banned: true }).where(eq(user.id, member.userId));

      expect(await readWelcomeNeighbours(database, admin.userId)).toEqual([]);
      expect(await readSharingMemberCount(database)).toBe(0);
    });

    it("hides a banned inviter on the invite page and in onboarding", async () => {
      const { link } = await createInvite();
      const token = link.split("/").at(-1) ?? "";
      await accept(link);
      const accepted = await readAccount();

      await database.update(user).set({ banned: true }).where(eq(user.id, admin.userId));

      expect((await readInviteByToken(database, token))?.inviter).toBeNull();
      expect(await readInviterOfMember(database, accepted?.id ?? "")).toBeNull();
    });
  });

  describe("the invite list", () => {
    async function seedOneOfEach() {
      const accepted = await createInvite("accepted@example.test");
      await accept(accepted.link);
      const expired = await createInvite("expired@example.test");
      await database.update(invite).set({ expiresAt: new Date(Date.now() - 1_000) }).where(eq(invite.id, expired.invite.id));
      await createInvite("pending@example.test");
    }

    async function list(body: unknown) {
      return inviteListSchema.parse(await (await postList(jsonRequest(admin.cookie, body))).json());
    }

    it("shows pending invites first", async () => {
      await seedOneOfEach();

      const { invites } = await list({});

      expect(invites.map(({ state }) => state)).toEqual([INVITE_STATES.pending, INVITE_STATES.expired, INVITE_STATES.accepted]);
    });

    it("filters by status, and counts every status", async () => {
      await seedOneOfEach();

      const { invites, counts } = await list({ filter: INVITE_STATES.accepted });

      expect(invites.map(({ email }) => email)).toEqual(["accepted@example.test"]);
      expect(counts).toEqual({ all: 3, pending: 1, accepted: 1, expired: 1, revoked: 0 });
    });

    it("pages at ten", async () => {
      for (let position = 0; position < 11; position += 1) await createInvite(`person-${position}@example.test`);

      const first = await list({ page: 1 });
      const second = await list({ page: 2 });

      expect(first.invites).toHaveLength(10);
      expect(second.invites).toHaveLength(1);
      expect(first.pageCount).toBe(2);
    });
  });
});
