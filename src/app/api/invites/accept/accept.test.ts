import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { account, rateLimit, user } from "@/platform/database/auth-schema";
import { invite, memberProfile } from "@/database/members-schema";
import { memberNetwork } from "@/database/village-schema";
import { getAuth } from "@/platform/auth/auth";
import { issuedInviteSchema } from "@/lib/invites/invite-api";
import { INVITE_STATES } from "@/lib/invites/invite-state";
import { readInviteByToken } from "@/lib/invites/invites";
import { advanceNetwork } from "@/lib/village/member-network";
import { createNetworkContext } from "@/platform/http/request-context";
import { saveVillageGroup } from "@/lib/village/settings";
import { saveVillageKeys } from "@/platform/village/settings";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postCreate } from "@/app/api/admin/invites/route";
import { POST as postRevoke } from "@/app/api/admin/invites/revoke/route";
import { POST as postAuth } from "@/app/api/auth/[...all]/route";
import { POST as postAccept } from "./route";

const APP_URL = "http://localhost:3000";
const INVITEE = "amara@tidewell.example";
const PASSWORD = "a-long-new-password";
const UNKNOWN_TOKEN = "A".repeat(43);
const FAILED_ATTEMPTS_PER_WINDOW = 10;
const OVERSIZED_BYTES = 64 * 1024;
const CREATED_STATUS = 201;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const GONE_STATUS = 410;
const TOO_LARGE_STATUS = 413;
const UNPROCESSABLE_STATUS = 422;
const TOO_MANY_REQUESTS_STATUS = 429;

function acceptRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${APP_URL}/api/invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL, ...headers },
    body: JSON.stringify(body),
  });
}

describe("accepting an invite", () => {
  const database = createTestDatabase();
  let admin: Awaited<ReturnType<typeof createSignedInMember>>;
  let token: string;
  let inviteId: string;

  function accept(fields: Record<string, unknown> = {}) {
    return postAccept(acceptRequest({ token, name: "Amara Osei", password: PASSWORD, ...fields }));
  }

  beforeEach(async () => {
    await clearDatabase(database);
    admin = await createSignedInMember(database, "admin");
    const response = await postCreate(
      new Request(`${APP_URL}/api/admin/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: admin.cookie },
        body: JSON.stringify({ email: INVITEE }),
      }),
    );
    const issued = issuedInviteSchema.parse(await response.json());
    token = z.string().parse(issued.link.split("/").at(-1));
    inviteId = issued.invite.id;
  });

  async function readInvitee() {
    const [invitee] = await database.select().from(user).where(eq(user.email, INVITEE));
    return invitee;
  }

  describe("with a valid link", () => {
    it("creates the account with the invite's email", async () => {
      const response = await accept();

      expect(response.status).toBe(CREATED_STATUS);
      expect(await readInvitee()).toMatchObject({ name: "Amara Osei", email: INVITEE, role: "user" });
    });

    it("leaves the email unverified, because holding a link doesn't prove owning the inbox", async () => {
      await accept();

      expect((await readInvitee())?.emailVerified).toBe(false);
    });

    it("ignores an email in the request", async () => {
      await accept({ email: "someone-else@example.test" });

      expect(await readInvitee()).toBeDefined();
      const [other] = await database.select().from(user).where(eq(user.email, "someone-else@example.test"));
      expect(other).toBeUndefined();
    });

    it("ignores a role in the request", async () => {
      await accept({ role: "admin" });

      expect((await readInvitee())?.role).toBe("user");
    });

    it("signs the person in", async () => {
      const response = await accept();
      const cookie = response.headers.getSetCookie()[0]?.split(";")[0] ?? "";
      const auth = await getAuth();

      const session = await auth.api.getSession({ headers: new Headers({ Cookie: cookie }) });

      expect(await response.json()).toEqual({ isSignedIn: true });
      expect(session?.user.email).toBe(INVITEE);
    });

    it("stores a real password that signs in again later", async () => {
      await accept();
      const auth = await getAuth();

      const { user: signedIn } = await auth.api.signInEmail({ body: { email: INVITEE, password: PASSWORD } });

      expect(signedIn.email).toBe(INVITEE);
    });

    it("starts onboarding", async () => {
      await accept();
      const invitee = await readInvitee();
      const [profile] = await database.select().from(memberProfile).where(eq(memberProfile.userId, invitee?.id ?? ""));

      expect(profile?.onboardingCompletedAt).toBeNull();
      expect(profile?.cardStepDoneAt).toBeNull();
    });

    it("marks the invite accepted by that account", async () => {
      await accept();
      const invitee = await readInvitee();
      const [row] = await database.select().from(invite).where(eq(invite.id, inviteId));

      expect(row?.acceptedAt).toBeInstanceOf(Date);
      expect(row?.acceptedUserId).toBe(invitee?.id);
    });

    it("keeps the invite usable after a too-short password", async () => {
      const response = await accept({ password: "short" });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect(await readInvitee()).toBeUndefined();
      expect((await accept()).status).toBe(CREATED_STATUS);
    });

    it("keeps the invite usable after a blank name", async () => {
      expect((await accept({ name: "   " })).status).toBe(UNPROCESSABLE_STATUS);
      expect((await accept()).status).toBe(CREATED_STATUS);
    });

    it("refuses someone already signed in, so they can't replace their session by accident", async () => {
      const response = await postAccept(
        acceptRequest({ token, name: "Amara Osei", password: PASSWORD }, { Cookie: admin.cookie }),
      );

      expect(response.status).toBe(CONFLICT_STATUS);
      expect(await readInvitee()).toBeUndefined();
    });
  });

  describe("single use", () => {
    it("refuses the link the second time", async () => {
      await accept();

      const second = await accept({ name: "Mallory" });

      expect(second.status).toBe(GONE_STATUS);
      expect((await readInvitee())?.name).toBe("Amara Osei");
    });

    it("creates one account from many simultaneous requests", async () => {
      const responses = await Promise.all(Array.from({ length: 8 }, () => accept()));
      const statuses = responses.map(({ status }) => status);

      expect(statuses.filter((status) => status === CREATED_STATUS)).toHaveLength(1);
      expect(statuses.filter((status) => status === GONE_STATUS).length).toBe(7);
      expect(await database.select().from(user).where(eq(user.email, INVITEE))).toHaveLength(1);
      expect(await database.select().from(account).innerJoin(user, eq(user.id, account.userId)).where(eq(user.email, INVITEE))).toHaveLength(1);
    });

    it("rolls back when the email already belongs to an account, and answers like a used link", async () => {
      await accept();
      const used = await accept();
      const usedBody = await used.json();
      await database.update(invite).set({ acceptedAt: null, acceptedUserId: null }).where(eq(invite.id, inviteId));

      const response = await accept({ name: "Mallory" });
      const [row] = await database.select().from(invite).where(eq(invite.id, inviteId));

      expect(response.status).toBe(used.status);
      expect(await response.json()).toEqual(usedBody);
      expect(row?.acceptedAt).toBeNull();
      expect((await readInvitee())?.name).toBe("Amara Osei");
    });
  });

  describe("with an unusable link", () => {
    it("explains an expired link and creates nothing", async () => {
      await database.update(invite).set({ expiresAt: new Date(Date.now() - 1_000) }).where(eq(invite.id, inviteId));

      const response = await accept();
      const body = z.object({ message: z.string() }).parse(await response.json());

      expect(response.status).toBe(GONE_STATUS);
      expect(body.message).toContain("expired");
      expect(await readInvitee()).toBeUndefined();
    });

    it("explains a revoked link and creates nothing", async () => {
      await postRevoke(
        new Request(`${APP_URL}/api/admin/invites/revoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: admin.cookie },
          body: JSON.stringify({ inviteId }),
        }),
      );

      const response = await accept();
      const body = z.object({ message: z.string() }).parse(await response.json());

      expect(response.status).toBe(GONE_STATUS);
      expect(body.message).toContain("withdrawn");
      expect(await readInvitee()).toBeUndefined();
    });

    it("doesn't reveal any email for an unknown token", async () => {
      const response = await postAccept(acceptRequest({ token: UNKNOWN_TOKEN, name: "A", password: PASSWORD }));
      const text = await response.text();

      expect(response.status).toBe(NOT_FOUND_STATUS);
      expect(text).not.toContain(INVITEE);
      expect(text).not.toContain("@");
    });

    it("treats a malformed token like an unknown one", async () => {
      const response = await postAccept(acceptRequest({ token: { $ne: "" }, name: "A", password: PASSWORD }));

      expect(response.status).toBe(NOT_FOUND_STATUS);
    });

    it("doesn't accept the stored hash as a token", async () => {
      const [row] = await database.select().from(invite).where(eq(invite.id, inviteId));

      expect(await readInviteByToken(database, row?.tokenHash ?? "")).toBeNull();
    });
  });

  describe("abuse limits", () => {
    async function failAttempts(count: number) {
      const statuses = [];
      for (let attempt = 0; attempt < count; attempt += 1) {
        const response = await postAccept(acceptRequest({ token: UNKNOWN_TOKEN, name: "A", password: PASSWORD }));
        statuses.push(response.status);
      }
      return statuses;
    }

    it("answers 429 after too many bad links", async () => {
      const statuses = await failAttempts(FAILED_ATTEMPTS_PER_WINDOW + 1);

      expect(statuses.at(FAILED_ATTEMPTS_PER_WINDOW - 1)).toBe(NOT_FOUND_STATUS);
      expect(statuses.at(-1)).toBe(TOO_MANY_REQUESTS_STATUS);
    });

    it("still lets a valid link through, so nobody can lock an invitee out", async () => {
      await failAttempts(FAILED_ATTEMPTS_PER_WINDOW + 1);

      expect((await accept()).status).toBe(CREATED_STATUS);
    });

    it("counts nothing for a successful accept", async () => {
      await accept();

      expect(await database.select().from(rateLimit)).toEqual([]);
    });

    it("refuses another site's origin before doing anything", async () => {
      const response = await postAccept(
        acceptRequest({ token, name: "Amara Osei", password: PASSWORD }, { Origin: "https://evil.test" }),
      );

      expect(response.status).toBe(FORBIDDEN_STATUS);
      expect(await readInvitee()).toBeUndefined();
    });

    it("refuses a missing origin", async () => {
      const request = new Request(`${APP_URL}/api/invites/accept`, {
        method: "POST",
        body: JSON.stringify({ token, name: "Amara Osei", password: PASSWORD }),
      });

      expect((await postAccept(request)).status).toBe(FORBIDDEN_STATUS);
    });

    it("refuses an oversized body", async () => {
      const response = await postAccept(
        new Request(`${APP_URL}/api/invites/accept`, {
          method: "POST",
          headers: { Origin: APP_URL },
          body: "x".repeat(OVERSIZED_BYTES),
        }),
      );

      expect(response.status).toBe(TOO_LARGE_STATUS);
    });
  });

  it("keeps public sign-up closed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await postAuth(
      new Request(`${APP_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: APP_URL },
        body: JSON.stringify({ name: "Mallory", email: INVITEE, password: PASSWORD }),
      }),
    );
    vi.restoreAllMocks();

    expect(response.ok).toBe(false);
    expect(await readInvitee()).toBeUndefined();
  });

  describe("with Village", () => {
    let village: Awaited<ReturnType<typeof startFakeVillageServer>>;

    beforeAll(async () => {
      village = await startFakeVillageServer();
      process.env.VILLAGE_API_URL = village.url;
    });

    afterAll(async () => {
      delete process.env.VILLAGE_API_URL;
      await village.stop();
    });

    it("mints the Village token with the invite's email", async () => {
      village.reset();
      await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
      await saveVillageGroup(database, { id: "group-1", inviteLink: "https://village.test/join/invite-code" });
      await accept({ email: "someone-else@example.test" });
      const invitee = await readInvitee();
      const [network] = await database
        .insert(memberNetwork)
        .values({ userId: invitee?.id ?? "", linkedinSlug: "amara-osei", sharingConsentedAt: new Date() })
        .returning();

      await database.update(user).set({ emailVerified: true }).where(eq(user.email, INVITEE));

      const member = { id: invitee?.id ?? "", email: invitee?.email ?? "", role: invitee?.role };
      await advanceNetwork(createNetworkContext(database, process.env, member));

      expect(village.state.mintedEmails.get(network?.villageExternalId ?? "")).toBe(INVITEE);
    });
  });

  it("reports the invite as pending until it's used", async () => {
    expect((await readInviteByToken(database, token))?.state).toBe(INVITE_STATES.pending);
  });
});
