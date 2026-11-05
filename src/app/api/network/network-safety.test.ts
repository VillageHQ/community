import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { user } from "@/platform/database/auth-schema";
import { memberDailyUsage } from "@/platform/village/schema";
import { memberNetwork, memberPathResult } from "@/database/village-schema";
import { NETWORK_ERROR_CODES, NETWORK_STAGES, networkPathsSchema, networkStatusSchema } from "@/lib/village/network-api";
import { deleteVillageGroup, readVillageGroup, saveVillageGroup } from "@/lib/village/settings";
import { saveVillageKeys } from "@/platform/village/settings";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postGroup } from "@/app/api/admin/village/group/route";
import { POST as postKeys } from "@/app/api/admin/village/keys/route";
import { POST as postLinks } from "@/app/api/admin/village/links/route";
import { POST as postConsent } from "./consent/route";
import { POST as postLeave } from "./leave/route";
import { POST as postLinkedin } from "./linkedin/route";
import { POST as postPaths, maxDuration as pathsMaxDuration } from "./paths/route";
import { POST as postSearch, maxDuration as searchMaxDuration } from "./search/route";
import { POST as postStatus } from "./status/route";

const APP_URL = "http://localhost:3000";
const OTHER_PERSON_EMAIL = "Someone.Else@Elsewhere.test";
const NORMALIZED_OTHER_PERSON_EMAIL = "someone.else@elsewhere.test";
const INVITE_LINK = "https://village.test/join/stored-invite";
const JOIN_PATH = "/v2/groups/join";
const LEAVE_PATH = "/v2/groups/leave";
const TOKEN_PATH = "/v2/auth/tokens";
const SEARCH_PATH = "/v2/people/search";
const PATHS_PATH = "/v2/people/paths";
const USER_PATH = "/v2/user/me";
const TARGET_SLUG = "target-person";
const TARGET_URL = `https://www.linkedin.com/in/${TARGET_SLUG}`;
const SLOW_PATHS_DELAY_MS = 15_500;
const SEARCH_TIMEOUT_SECONDS = 120;
const SLOW_TEST_TIMEOUT_MS = 60_000;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function jsonRequest(member: Member | null, body: unknown, origin: string | null = APP_URL) {
  return new Request(`${APP_URL}/api/network`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
      ...(member ? { Cookie: member.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("member network safeguards", () => {
  const database = createTestDatabase();
  let village: Awaited<ReturnType<typeof startFakeVillageServer>>;

  async function readNetwork(member: Member) {
    const [network] = await database
      .select()
      .from(memberNetwork)
      .where(eq(memberNetwork.userId, member.userId));
    if (!network) throw new Error("The member has no network row.");
    return network;
  }

  async function readStatus(member: Member) {
    return networkStatusSchema.parse(await (await postStatus(jsonRequest(member, {}))).json());
  }

  async function readUsageCount(member: Member) {
    const [usage] = await database
      .select()
      .from(memberDailyUsage)
      .where(eq(memberDailyUsage.userId, member.userId));
    return usage?.callCount ?? 0;
  }

  async function createConsentedMember(slug: string, role: "admin" | "user" = "user") {
    const member = await createSignedInMember(database, role);
    await postLinkedin(jsonRequest(member, { linkedinUrl: `https://www.linkedin.com/in/${slug}` }));
    await postConsent(jsonRequest(member, { acknowledged: true }));
    return member;
  }

  async function linkMember(member: Member, email?: string, isSynced = true) {
    await readStatus(member);
    const { villageExternalId } = await readNetwork(member);
    village.state.linkedMembers.set(villageExternalId, { isSynced, email });
    return villageExternalId;
  }

  async function createJoinedMember(slug: string, role: "admin" | "user" = "user") {
    const member = await createConsentedMember(slug, role);
    await linkMember(member);
    expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.ready);
    return member;
  }

  function search(member: Member, prompt = "founders") {
    return postSearch(jsonRequest(member, { prompt }));
  }

  function readPaths(member: Member, slug = TARGET_SLUG) {
    return postPaths(jsonRequest(member, { linkedinSlug: slug }));
  }

  beforeAll(async () => {
    village = await startFakeVillageServer();
    process.env.VILLAGE_API_URL = village.url;
  });

  afterAll(async () => {
    delete process.env.VILLAGE_API_URL;
    await village.stop();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    village.reset();
    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    await saveVillageGroup(database, { id: "group-1", inviteLink: INVITE_LINK });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("a Village account linked under another email", () => {
    async function createSquattingMember() {
      const member = await createConsentedMember("squatter");
      await linkMember(member, OTHER_PERSON_EMAIL);
      return member;
    }

    it("never joins the other person to the group", async () => {
      const member = await createSquattingMember();

      const status = await readStatus(member);

      expect(status.stage).toBe(NETWORK_STAGES.linkMismatch);
      expect(village.readRequests(JOIN_PATH)).toEqual([]);
    });

    it("keeps the other person's email from the member", async () => {
      const member = await createSquattingMember();

      const statusBody = await (await postStatus(jsonRequest(member, {}))).text();
      await database
        .update(memberNetwork)
        .set({ groupJoinedAt: new Date() })
        .where(eq(memberNetwork.userId, member.userId));
      const searchBody = await (await search(member)).text();

      expect(statusBody.toLowerCase()).not.toContain(NORMALIZED_OTHER_PERSON_EMAIL);
      expect(searchBody.toLowerCase()).not.toContain(NORMALIZED_OTHER_PERSON_EMAIL);
    });

    it("accepts the same email in another case", async () => {
      const member = await createConsentedMember("same-person");
      await linkMember(member, member.email.toUpperCase());

      expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.ready);
    });

    describe("after the member already joined", () => {
      async function createJoinedThenSquatted() {
        const member = await createJoinedMember("was-fine");
        const { villageExternalId } = await readNetwork(member);
        village.state.linkedMembers.set(villageExternalId, {
          isSynced: true,
          email: OTHER_PERSON_EMAIL,
        });
        return member;
      }

      it("blocks search", async () => {
        const member = await createJoinedThenSquatted();

        const response = await search(member);

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.linkMismatch });
        expect(village.readRequests(SEARCH_PATH)).toEqual([]);
      });

      it("blocks paths, including cached ones", async () => {
        const member = await createJoinedMember("was-fine");
        await readPaths(member);
        const { villageExternalId } = await readNetwork(member);
        village.state.linkedMembers.set(villageExternalId, {
          isSynced: true,
          email: OTHER_PERSON_EMAIL,
        });

        const response = await readPaths(member);

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.linkMismatch });
      });

      it("reports the mismatch stage", async () => {
        const member = await createJoinedThenSquatted();

        expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.linkMismatch);
      });

      it("blocks leaving, which would remove the other person", async () => {
        const member = await createJoinedThenSquatted();

        const response = await postLeave(jsonRequest(member, { confirmed: true }));

        expect(response.status).toBe(409);
        expect(village.readRequests(LEAVE_PATH)).toEqual([]);
      });
    });

    it("blocks an admin from creating the group with it", async () => {
      await deleteVillageGroup(database);
      const admin = await createSignedInMember(database, "admin");
      await postLinkedin(jsonRequest(admin, { linkedinUrl: "https://linkedin.com/in/fund-admin" }));
      await linkMember(admin, OTHER_PERSON_EMAIL);

      const response = await postGroup(jsonRequest(admin, { name: "Fund", acknowledged: true }));

      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.linkMismatch });
      expect(village.state.createdGroups).toEqual([]);
    });

    describe("admin approval", () => {
      async function approve(admin: Member, member: Member, villageEmail: string) {
        return postLinks(jsonRequest(admin, { memberId: member.userId, villageEmail }));
      }

      it("lets the member continue and join", async () => {
        const member = await createSquattingMember();
        await readStatus(member);
        const admin = await createSignedInMember(database, "admin");

        const response = await approve(admin, member, NORMALIZED_OTHER_PERSON_EMAIL);

        expect(response.status).toBe(200);
        expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.ready);
        expect(village.readRequests(JOIN_PATH)).toHaveLength(1);
      });

      it("refuses a member who isn't an admin", async () => {
        const member = await createSquattingMember();
        await readStatus(member);

        const response = await approve(member, member, NORMALIZED_OTHER_PERSON_EMAIL);

        expect(response.status).toBe(403);
        expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.linkMismatch);
      });

      it("refuses a Village email that isn't the one waiting", async () => {
        const member = await createSquattingMember();
        await readStatus(member);
        const admin = await createSignedInMember(database, "admin");

        const response = await approve(admin, member, "another@elsewhere.test");

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.linkChanged });
      });

      describe("after approval", () => {
        async function createApprovedMember() {
          const member = await createSquattingMember();
          await readStatus(member);
          const admin = await createSignedInMember(database, "admin");
          await approve(admin, member, NORMALIZED_OTHER_PERSON_EMAIL);
          return member;
        }

        it("blocks again when the Village email changes", async () => {
          const member = await createApprovedMember();
          const { villageExternalId } = await readNetwork(member);
          village.state.linkedMembers.set(villageExternalId, {
            isSynced: true,
            email: "third@elsewhere.test",
          });

          expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.linkMismatch);
        });

        it("blocks again when the member's email changes", async () => {
          const member = await createApprovedMember();
          await database
            .update(user)
            .set({ email: "renamed@members.test" })
            .where(eq(user.id, member.userId));

          expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.linkMismatch);
        });
      });
    });
  });

  describe("the daily limit under failures Village may have debited", () => {
    let member: Member;

    beforeEach(async () => {
      member = await createJoinedMember("spender");
    });

    function failFetchFor(path: string, error: Error) {
      const realFetch = globalThis.fetch;
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        if (String(input).endsWith(path)) throw error;
        return realFetch(input, init);
      });
    }

    it("counts a 200 with an unreadable body and caches nothing", async () => {
      village.state.unparsableBodyPaths.add(PATHS_PATH);
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      for (let attempt = 0; attempt < 5; attempt += 1) await readPaths(member);

      expect(await readUsageCount(member)).toBe(5);
      expect(await database.select().from(memberPathResult)).toEqual([]);
    });

    it("counts a timed-out search", async () => {
      failFetchFor(SEARCH_PATH, new DOMException("Timed out", "TimeoutError"));

      await search(member);

      expect(await readUsageCount(member)).toBe(1);
    });

    it("counts a network error on paths", async () => {
      failFetchFor(PATHS_PATH, new TypeError("fetch failed"));

      const response = await readPaths(member);

      expect(response.status).toBe(502);
      expect(await readUsageCount(member)).toBe(1);
    });

    it("refunds Village error responses", async () => {
      village.state.failures.set(SEARCH_PATH, { status: 400, type: "bad_request" });
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      await search(member);

      expect(await readUsageCount(member)).toBe(0);
    });

    it(
      "waits for a paths response slower than 15 seconds",
      async () => {
        village.state.delayMsByPath.set(PATHS_PATH, SLOW_PATHS_DELAY_MS);
        village.state.pathsByUrl.set(TARGET_URL, { summary: "summary", paths: [] });

        const response = await readPaths(member);

        expect(response.status).toBe(200);
        expect(await database.select().from(memberPathResult)).toHaveLength(1);
      },
      SLOW_TEST_TIMEOUT_MS,
    );
  });

  describe("a 404 from paths", () => {
    it("caches no paths and counts nothing when the member is still linked", async () => {
      const member = await createJoinedMember("reader");

      const response = await readPaths(member);

      expect(networkPathsSchema.parse(await response.json()).paths).toEqual([]);
      expect(await database.select().from(memberPathResult)).toHaveLength(1);
      expect(await readUsageCount(member)).toBe(0);
    });

    it("explains the unlinked state and caches nothing when the link is gone", async () => {
      const member = await createJoinedMember("reader");
      village.state.isUnlinkedOnPathsRequest = true;

      const response = await readPaths(member);

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.notLinked });
      expect(await database.select().from(memberPathResult)).toEqual([]);
      expect(await readUsageCount(member)).toBe(0);
    });
  });

  describe("off-network results", () => {
    it.each([["global"], [undefined], ["anything-else"]])(
      "discards results when the source is %s",
      async (source) => {
        const member = await createJoinedMember("reader");
        village.state.searchPeople = [{ full_name: "Stranger", linkedin_url: TARGET_URL }];
        village.state.searchSource = source;
        vi.spyOn(console, "log").mockImplementation(() => undefined);

        const body = await (await search(member)).json();

        expect(body).toMatchObject({ people: [], discardedOffNetworkResults: true });
      },
    );
  });

  describe("long searches", () => {
    it("gives platforms more time than the Village timeout", () => {
      expect(searchMaxDuration).toBeGreaterThan(SEARCH_TIMEOUT_SECONDS);
      expect(pathsMaxDuration).toBeGreaterThan(60);
    });

    it("explains a timed-out search", async () => {
      const member = await createJoinedMember("reader");
      const realFetch = globalThis.fetch;
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        if (String(input).endsWith(SEARCH_PATH)) {
          throw new DOMException("Timed out", "TimeoutError");
        }
        return realFetch(input, init);
      });

      const response = await search(member);

      expect(response.status).toBe(504);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.searchCutOff });
    });

    it("explains a search that returns a body that isn't JSON", async () => {
      const member = await createJoinedMember("reader");
      village.state.unparsableBodyPaths.add(SEARCH_PATH);
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await search(member);

      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.searchCutOff });
    });
  });

  describe("token reuse", () => {
    it("mints once across repeated polls", async () => {
      const member = await createConsentedMember("poller");
      await readStatus(member);
      await readStatus(member);
      await readStatus(member);

      expect(village.readRequests(TOKEN_PATH)).toHaveLength(1);
      expect(village.readRequests(USER_PATH)).toHaveLength(3);
    });

    it("mints a new token when the secret key changes", async () => {
      const member = await createConsentedMember("poller");
      await readStatus(member);
      await saveVillageKeys(database, {
        publicKey: FAKE_VILLAGE_KEYS.publicKey,
        secretKey: "sk_rotated",
      });
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await postStatus(jsonRequest(member, {}));

      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.keysRejected });
    });
  });

  describe("the Origin check", () => {
    const STATE_CHANGING_ROUTES = [
      ["status", postStatus],
      ["linkedin", postLinkedin],
      ["consent", postConsent],
      ["search", postSearch],
      ["paths", postPaths],
      ["leave", postLeave],
      ["keys", postKeys],
      ["group", postGroup],
      ["links", postLinks],
    ] as const;

    it.each(STATE_CHANGING_ROUTES)("refuses a foreign Origin on %s", async (_name, post) => {
      const admin = await createSignedInMember(database, "admin");

      const response = await post(jsonRequest(admin, {}, "https://evil.test"));

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.forbiddenOrigin });
    });

    it.each(STATE_CHANGING_ROUTES)("refuses a missing Origin on %s", async (_name, post) => {
      const admin = await createSignedInMember(database, "admin");

      const response = await post(jsonRequest(admin, {}, null));

      expect(response.status).toBe(403);
    });

    it("records no consent from a foreign Origin", async () => {
      const member = await createSignedInMember(database);
      await postLinkedin(jsonRequest(member, { linkedinUrl: "https://linkedin.com/in/victim" }));

      await postConsent(jsonRequest(member, { acknowledged: true }, "https://evil.test"));

      expect((await readNetwork(member)).sharingConsentedAt).toBeNull();
    });
  });

  describe("leaving the group", () => {
    it("requires confirmation", async () => {
      const member = await createJoinedMember("leaver");

      const response = await postLeave(jsonRequest(member, { confirmed: false }));

      expect(response.status).toBe(422);
      expect(village.readRequests(LEAVE_PATH)).toEqual([]);
    });

    it("leaves in Village, forgets consent and cached paths, and asks for consent again", async () => {
      await createJoinedMember("stays-in-group");
      const member = await createJoinedMember("leaver");
      await readPaths(member);

      const response = await postLeave(jsonRequest(member, { confirmed: true }));

      expect(response.status).toBe(200);
      expect(village.readRequests(LEAVE_PATH).map(({ body }) => body)).toEqual([
        { group_id: "group-1" },
      ]);
      const network = await readNetwork(member);
      expect(network.groupJoinedAt).toBeNull();
      expect(network.sharingConsentedAt).toBeNull();
      expect(
        await database
          .select()
          .from(memberPathResult)
          .where(eq(memberPathResult.userId, member.userId)),
      ).toEqual([]);
      expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.needsConsent);
      expect(await readVillageGroup(database)).not.toBeNull();
    });

    it("blocks search after leaving", async () => {
      await createJoinedMember("stays-in-group");
      const member = await createJoinedMember("leaver");
      await postLeave(jsonRequest(member, { confirmed: true }));

      const response = await search(member);

      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.notReady });
    });

    it("explains why a group admin with other members can't leave", async () => {
      const admin = await createJoinedMember("group-admin", "admin");
      village.state.failures.set(LEAVE_PATH, { status: 400, type: "bad_request" });

      const response = await postLeave(jsonRequest(admin, { confirmed: true }));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body).toMatchObject({ code: NETWORK_ERROR_CODES.groupAdminCannotLeave });
      expect(body.message).toContain("every other member");
      expect((await readNetwork(admin)).groupJoinedAt).not.toBeNull();
    });

    it("treats a Village 404 as already left", async () => {
      await createJoinedMember("stays-in-group");
      const member = await createJoinedMember("leaver");
      village.state.failures.set(LEAVE_PATH, { status: 404, type: "not_found" });

      const response = await postLeave(jsonRequest(member, { confirmed: true }));

      expect(response.status).toBe(200);
      expect((await readNetwork(member)).groupJoinedAt).toBeNull();
    });

    it("forgets the group when the last member leaves, because Village deletes it", async () => {
      const lastMember = await createJoinedMember("last-member", "admin");

      await postLeave(jsonRequest(lastMember, { confirmed: true }));

      expect(await readVillageGroup(database)).toBeNull();
    });

    it("refuses a member who isn't in the group", async () => {
      const member = await createConsentedMember("outsider");

      const response = await postLeave(jsonRequest(member, { confirmed: true }));

      expect(response.status).toBe(409);
    });

    it("surfaces other Village failures as friendly errors and stays joined", async () => {
      const member = await createJoinedMember("leaver");
      village.state.failures.set(LEAVE_PATH, { status: 500, type: "internal_error" });
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await postLeave(jsonRequest(member, { confirmed: true }));

      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.unavailable });
      expect((await readNetwork(member)).groupJoinedAt).not.toBeNull();
    });
  });
});
