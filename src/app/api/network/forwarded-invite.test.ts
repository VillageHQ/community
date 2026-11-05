import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createEmailVerificationToken } from "better-auth/api";

import { user, verification } from "@/database/auth-schema";
import { invite } from "@/database/members-schema";
import { memberNetwork } from "@/database/village-schema";
import { getAuth } from "@/lib/auth";
import { readConfirmationView, toConfirmationIdentifier } from "@/lib/invites/email-confirmation";
import { CONFIRMATION_VIEWS } from "@/lib/invites/email-confirmation-views";
import { issuedInviteSchema } from "@/lib/invites/invite-api";
import { resolveOnboardingStep } from "@/lib/members/onboarding";
import { ONBOARDING_STEPS } from "@/lib/members/profile-api";
import { NETWORK_ERROR_CODES, NETWORK_STAGES, networkStatusSchema } from "@/lib/village/network-api";
import { NETWORK_PROGRESS, readNetworkProgress } from "@/lib/village/network-progress";
import { saveVillageGroup, saveVillageKeys } from "@/lib/village/settings";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postConfirmMember } from "../admin/members/confirm/route";
import { POST as postInvite } from "../admin/invites/route";
import { POST as postReclaim } from "../admin/invites/reclaim/route";
import { GET as getAuthRoute, POST as postAuthRoute } from "../auth/[...all]/route";
import { POST as postAccept } from "../invites/accept/route";
import { POST as postOnboarding } from "../onboarding/route";
import { POST as postConfirm } from "./confirmation/confirm/route";
import { POST as postConfirmation } from "./confirmation/route";
import { POST as postConsent } from "./consent/route";
import { POST as postPaths } from "./paths/route";
import { POST as postSearch } from "./search/route";
import { POST as postStatus } from "./status/route";

const APP_URL = "http://localhost:3000";
const ALICE_EMAIL = "alice@example.test";
const HOLDER_PASSWORD = "the-link-holders-password";
const GROUP = { id: "group-1", inviteLink: "https://village.test/join/invite-code" };
const JOIN_PATH = "/v2/groups/join";
const TOKEN_PATH = "/v2/auth/tokens";
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const CONFLICT_STATUS = 409;
const GONE_STATUS = 410;
const TOO_MANY_REQUESTS_STATUS = 429;
const CONFIRMATION_LINK_PATTERN = /http:\/\/localhost:3000\/confirm-email\?token=([A-Za-z0-9_-]+)/;

const errorBodySchema = z.object({ code: z.string() });
const emailBodySchema = z.object({ to: z.array(z.string()), text: z.string() });

type Holder = { cookie: string; id: string; email: string };

function jsonRequest(cookie: string | null, body: unknown, path = "/api/network") {
  return new Request(`${APP_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describe("a forwarded invite", () => {
  const database = createTestDatabase();
  let village: Awaited<ReturnType<typeof startFakeVillageServer>>;
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let admin: Awaited<ReturnType<typeof createSignedInMember>>;

  async function inviteAlice() {
    const response = await postInvite(jsonRequest(admin.cookie, { email: ALICE_EMAIL }));
    return issuedInviteSchema.parse(await response.json());
  }

  async function acceptAs(name: string, link: string): Promise<Holder> {
    const token = link.split("/").at(-1);
    const response = await postAccept(jsonRequest(null, { token, name, password: HOLDER_PASSWORD }));
    const cookie = response.headers.getSetCookie()[0]?.split(";")[0];
    if (!cookie) throw new Error("Accepting set no session cookie.");
    const [account] = await database.select().from(user).where(eq(user.email, ALICE_EMAIL));
    if (!account) throw new Error("Accepting created no account.");
    return { cookie, id: account.id, email: account.email };
  }

  async function holderWithAliceVillageAccount() {
    const { link } = await inviteAlice();
    const holder = await acceptAs("Not Alice", link);
    const [network] = await database
      .insert(memberNetwork)
      .values({ userId: holder.id, linkedinSlug: "not-alice", sharingConsentedAt: new Date() })
      .returning();
    village.state.linkedMembers.set(network?.villageExternalId ?? "", { isSynced: true, email: ALICE_EMAIL });
    village.state.requests = [];
    return holder;
  }

  async function readStage(holder: Holder) {
    const response = await postStatus(jsonRequest(holder.cookie, {}));
    return networkStatusSchema.parse(await response.json()).stage;
  }

  async function readConfirmationToken() {
    const emailBody = emailBodySchema.parse(resend.state.emails.at(-1)?.body);
    const token = emailBody.text.match(CONFIRMATION_LINK_PATTERN)?.[1];
    if (!token) throw new Error("The email has no confirmation link.");
    return token;
  }

  function postConfirmToken(cookie: string | null, token: string, origin = APP_URL) {
    return postConfirm(
      new Request(`${APP_URL}/api/network/confirmation/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify({ token }),
      }),
    );
  }

  async function readIsVerified(holder: Holder) {
    const [account] = await database.select().from(user).where(eq(user.id, holder.id));
    return account?.emailVerified;
  }

  function configureResend() {
    vi.stubEnv("RESEND_API_URL", resend.url);
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@northwind.example>");
  }

  beforeAll(async () => {
    village = await startFakeVillageServer();
    resend = await startFakeResendServer();
    process.env.VILLAGE_API_URL = village.url;
  });

  afterAll(async () => {
    delete process.env.VILLAGE_API_URL;
    await village.stop();
    await resend.stop();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    village.reset();
    resend.reset();
    admin = await createSignedInMember(database, "admin");
    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    await saveVillageGroup(database, GROUP);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("when the holder links Alice's Village account", () => {
    it("doesn't join the group on the holder's consent, even though the emails match", async () => {
      const holder = await holderWithAliceVillageAccount();

      expect(await readStage(holder)).toBe(NETWORK_STAGES.needsEmailConfirmation);
      expect(village.readRequests(JOIN_PATH)).toEqual([]);
    });

    it("mints no Village token for the holder", async () => {
      const holder = await holderWithAliceVillageAccount();

      await readStage(holder);

      expect(village.readRequests(TOKEN_PATH)).toEqual([]);
    });

    it("blocks search through Alice's network", async () => {
      const holder = await holderWithAliceVillageAccount();
      await database.update(memberNetwork).set({ groupJoinedAt: new Date() }).where(eq(memberNetwork.userId, holder.id));

      const response = await postSearch(jsonRequest(holder.cookie, { prompt: "her investors" }));

      expect(response.status).toBe(CONFLICT_STATUS);
      expect(errorBodySchema.parse(await response.json()).code).toBe(NETWORK_ERROR_CODES.emailNotConfirmed);
    });

    it("blocks path lookups", async () => {
      const holder = await holderWithAliceVillageAccount();
      await database.update(memberNetwork).set({ groupJoinedAt: new Date() }).where(eq(memberNetwork.userId, holder.id));

      const response = await postPaths(jsonRequest(holder.cookie, { linkedinSlug: "target-person" }));

      expect(response.status).toBe(CONFLICT_STATUS);
      expect(village.readRequests(TOKEN_PATH)).toEqual([]);
    });

    it("records no consent from an unconfirmed account", async () => {
      const { link } = await inviteAlice();
      const holder = await acceptAs("Not Alice", link);

      const response = await postConsent(jsonRequest(holder.cookie, { acknowledged: true }));

      expect(response.status).toBe(CONFLICT_STATUS);
    });

    it("says the same on the feed as the status route", async () => {
      const holder = await holderWithAliceVillageAccount();

      expect(await readNetworkProgress(database, { id: holder.id, email: holder.email })).toBe(
        NETWORK_PROGRESS.needsEmailConfirmation,
      );
    });

    it("can't verify itself through Better Auth's update route", async () => {
      const { link } = await inviteAlice();
      const holder = await acceptAs("Not Alice", link);

      await postAuthRoute(
        new Request(`${APP_URL}/api/auth/update-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: holder.cookie },
          body: JSON.stringify({ name: "Still Not Alice", emailVerified: true }),
        }),
      );
      const [account] = await database.select().from(user).where(eq(user.id, holder.id));

      expect(account?.emailVerified).toBe(false);
    });
  });

  describe("with Resend", () => {
    beforeEach(configureResend);

    it("emails the confirmation link to the account's address, not to the holder's browser", async () => {
      const { link } = await inviteAlice();
      const token = link.split("/").at(-1);

      const response = await postAccept(jsonRequest(null, { token, name: "Not Alice", password: HOLDER_PASSWORD }));
      const emailBody = emailBodySchema.parse(resend.state.emails.at(-1)?.body);

      expect(emailBody.to).toEqual([ALICE_EMAIL]);
      expect(await response.text()).not.toContain("confirm-email");
    });

    it("warns the inbox owner when it wasn't them", async () => {
      const { link } = await inviteAlice();

      await acceptAs("Not Alice", link);
      const emailBody = emailBodySchema.parse(resend.state.emails.at(-1)?.body);

      expect(emailBody.text).toContain("Not Alice");
      expect(emailBody.text).toContain("If that wasn't you");
    });

    it("keeps the account when the email fails", async () => {
      resend.state.failureStatus = 500;
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { link } = await inviteAlice();
      resend.state.failureStatus = 500;

      const holder = await acceptAs("Alice", link);

      expect(await readStage(holder)).toBe(NETWORK_STAGES.needsEmailConfirmation);
    });

    describe("confirming with the emailed link", () => {
      let holder: Holder;
      let token: string;

      beforeEach(async () => {
        holder = await holderWithAliceVillageAccount();
        token = await readConfirmationToken();
      });

      it("doesn't verify anyone when a mail scanner opens the link with no cookies", async () => {
        const view = await readConfirmationView(database, token, null);

        expect(view).toBe(CONFIRMATION_VIEWS.signIn);
        expect(await readIsVerified(holder)).toBe(false);
        expect(await readStage(holder)).toBe(NETWORK_STAGES.needsEmailConfirmation);
      });

      it("leaves the token usable after a cookieless open", async () => {
        await readConfirmationView(database, token, null);

        expect(await readConfirmationView(database, token, { id: holder.id })).toBe(CONFIRMATION_VIEWS.confirm);
      });

      it("refuses a cookieless POST, without consuming the token", async () => {
        const response = await postConfirmToken(null, token);

        expect(response.status).toBe(UNAUTHORIZED_STATUS);
        expect(await readIsVerified(holder)).toBe(false);
        expect(await readConfirmationView(database, token, { id: holder.id })).toBe(CONFIRMATION_VIEWS.confirm);
      });

      it("refuses another site's origin", async () => {
        const response = await postConfirmToken(holder.cookie, token, "https://evil.test");

        expect(response.status).toBe(FORBIDDEN_STATUS);
        expect(await readIsVerified(holder)).toBe(false);
      });

      it("refuses a different signed-in account, without confirming or consuming", async () => {
        const other = await createSignedInMember(database);

        const response = await postConfirmToken(other.cookie, token);

        expect(response.status).toBe(FORBIDDEN_STATUS);
        expect(await readConfirmationView(database, token, { id: other.userId })).toBe(CONFIRMATION_VIEWS.wrongAccount);
        expect(await readIsVerified(holder)).toBe(false);
        expect((await postConfirmToken(holder.cookie, token)).ok).toBe(true);
      });

      it("confirms the right account, and only then opens the network", async () => {
        const response = await postConfirmToken(holder.cookie, token);

        expect(response.ok).toBe(true);
        expect(await readIsVerified(holder)).toBe(true);
        expect(await readStage(holder)).toBe(NETWORK_STAGES.ready);
      });

      it("works once", async () => {
        await postConfirmToken(holder.cookie, token);

        const second = await postConfirmToken(holder.cookie, token);

        expect(second.status).toBe(GONE_STATUS);
        expect(await readConfirmationView(database, token, { id: holder.id })).toBe(CONFIRMATION_VIEWS.invalid);
      });

      it("works for only one of two simultaneous requests", async () => {
        const responses = await Promise.all([postConfirmToken(holder.cookie, token), postConfirmToken(holder.cookie, token)]);

        expect(responses.filter(({ ok }) => ok)).toHaveLength(1);
      });

      it("expires", async () => {
        await database
          .update(verification)
          .set({ expiresAt: new Date(Date.now() - 1_000) })
          .where(eq(verification.identifier, toConfirmationIdentifier(holder.id)));

        const response = await postConfirmToken(holder.cookie, token);

        expect(response.status).toBe(GONE_STATUS);
        expect(await readIsVerified(holder)).toBe(false);
      });

      it("stores only a hash of the token", async () => {
        const rows = await database.select().from(verification);

        expect(JSON.stringify(rows)).not.toContain(token);
      });

      it("can't be confirmed through Better Auth's GET route, even with a token signed with the app's secret", async () => {
        const auth = await getAuth();
        const { secret } = await auth.$context;
        const signedToken = await createEmailVerificationToken(secret, ALICE_EMAIL, undefined, 3600, { userId: holder.id });

        const response = await getAuthRoute(new Request(`${APP_URL}/api/auth/verify-email?token=${signedToken}`));

        expect(response.ok).toBe(false);
        expect(await readIsVerified(holder)).toBe(false);
      });
    });

    it("refuses a confirmation link from an account that was reclaimed", async () => {
      const issued = await inviteAlice();
      await acceptAs("Not Alice", issued.link);
      const staleToken = await readConfirmationToken();

      const reclaim = await postReclaim(jsonRequest(admin.cookie, { inviteId: issued.invite.id }));
      const { link } = issuedInviteSchema.parse(await reclaim.json());
      const alice = await acceptAs("Alice", link);
      const response = await postConfirmToken(alice.cookie, staleToken);

      expect(response.status).toBe(GONE_STATUS);
      expect(await readStage(alice)).toBe(NETWORK_STAGES.needsEmailConfirmation);
    });

    it("sends another link from the network page", async () => {
      const { link } = await inviteAlice();
      const member = await acceptAs("Alice", link);
      resend.reset();

      await postConfirmation(jsonRequest(member.cookie, {}));

      expect(emailBodySchema.parse(resend.state.emails.at(-1)?.body).to).toEqual([ALICE_EMAIL]);
    });

    it("limits how often a member can send it", async () => {
      const { link } = await inviteAlice();
      const member = await acceptAs("Alice", link);

      const statuses = [];
      for (let attempt = 0; attempt < 4; attempt += 1) {
        statuses.push((await postConfirmation(jsonRequest(member.cookie, {}))).status);
      }

      expect(statuses.at(-1)).toBe(TOO_MANY_REQUESTS_STATUS);
    });

    it("leaves Better Auth's public send route inert, so nobody can spam an inbox", async () => {
      const { link } = await inviteAlice();
      await acceptAs("Alice", link);
      resend.reset();

      const response = await postAuthRoute(
        new Request(`${APP_URL}/api/auth/send-verification-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: APP_URL },
          body: JSON.stringify({ email: ALICE_EMAIL }),
        }),
      );

      expect(response.ok).toBe(false);
      expect(resend.state.emails).toEqual([]);
    });
  });

  describe("without Resend", () => {
    it("sends nothing, and explains why no link can be sent again", async () => {
      const { link } = await inviteAlice();
      const member = await acceptAs("Alice", link);

      const response = await postConfirmation(jsonRequest(member.cookie, {}));

      expect(response.ok).toBe(false);
      expect(resend.state.emails).toEqual([]);
    });

    it("lets an admin confirm the member with one click", async () => {
      const holder = await holderWithAliceVillageAccount();

      const response = await postConfirmMember(jsonRequest(admin.cookie, { memberId: holder.id }));

      expect(response.ok).toBe(true);
      expect(await readStage(holder)).toBe(NETWORK_STAGES.ready);
      expect(village.readRequests(JOIN_PATH)).toHaveLength(1);
    });
  });

  describe("during onboarding", () => {
    it("shows the waiting step after the card, and lets the member carry on to the feed", async () => {
      const { link } = await inviteAlice();
      const member = await acceptAs("Alice", link);
      const sessionMember = { id: member.id, email: member.email };
      await postOnboarding(jsonRequest(member.cookie, { step: ONBOARDING_STEPS.card }));

      expect(await resolveOnboardingStep(database, sessionMember)).toBe(ONBOARDING_STEPS.network);

      await postOnboarding(jsonRequest(member.cookie, { step: ONBOARDING_STEPS.network }));

      expect(await resolveOnboardingStep(database, sessionMember)).toBe(ONBOARDING_STEPS.done);
    });
  });

  describe("existing members", () => {
    it("keep a member with an approved pair working, even unverified", async () => {
      const member = await createSignedInMember(database);
      await database.update(user).set({ emailVerified: false }).where(eq(user.id, member.userId));
      const [network] = await database
        .insert(memberNetwork)
        .values({
          userId: member.userId,
          linkedinSlug: "approved-member",
          sharingConsentedAt: new Date(),
          approvedMemberEmail: member.email,
          approvedVillageEmail: "their-village@example.test",
        })
        .returning();
      village.state.linkedMembers.set(network?.villageExternalId ?? "", {
        isSynced: true,
        email: "their-village@example.test",
      });

      expect(await readStage({ cookie: member.cookie, id: member.userId, email: member.email })).toBe(NETWORK_STAGES.ready);
    });

    it("keep a verified member's email match trusted", async () => {
      const member = await createSignedInMember(database);
      const [network] = await database
        .insert(memberNetwork)
        .values({ userId: member.userId, linkedinSlug: "verified-member", sharingConsentedAt: new Date() })
        .returning();
      village.state.linkedMembers.set(network?.villageExternalId ?? "", { isSynced: true, email: member.email });

      expect(await readStage({ cookie: member.cookie, id: member.userId, email: member.email })).toBe(NETWORK_STAGES.ready);
    });

    it("become verified through the migration, but accounts from invites don't", async () => {
      const older = await createSignedInMember(database);
      await database.update(user).set({ emailVerified: false }).where(eq(user.id, older.userId));
      const { link } = await inviteAlice();
      const invited = await acceptAs("Alice", link);
      const drizzleDirectory = resolve(import.meta.dirname, "../../../../drizzle");
      const migrationFile = readdirSync(drizzleDirectory).find((file) => file.startsWith("0005_"));
      const migration = readFileSync(resolve(drizzleDirectory, migrationFile ?? ""), "utf8");

      await database.execute(sql.raw(migration));
      const [olderAccount] = await database.select().from(user).where(eq(user.id, older.userId));
      const [invitedAccount] = await database.select().from(user).where(eq(user.id, invited.id));

      expect(olderAccount?.emailVerified).toBe(true);
      expect(invitedAccount?.emailVerified).toBe(false);
    });
  });

  it("treats the first admin from setup as verified", async () => {
    await clearDatabase(database);
    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    const { claimFirstAdmin } = await import("@/lib/first-admin");

    await claimFirstAdmin(database, { name: "Ada", email: "ada@example.test", password: "correct-horse-battery" });
    const [firstAdmin] = await database.select().from(user).where(eq(user.email, "ada@example.test"));

    expect(firstAdmin?.emailVerified).toBe(true);
    expect(await database.select().from(invite)).toEqual([]);
  });
});
