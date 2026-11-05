import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { memberDailyUsage } from "@/platform/village/schema";
import { memberNetwork } from "@/modules/members/schema";
import { memberPathResult } from "@/database/village-schema";
import { DAILY_LOOKUP_LIMITS } from "@/platform/village/contract";
import {
  NETWORK_ERROR_CODES,
  NETWORK_STAGES,
  networkPathsSchema,
  networkSearchResultSchema,
  networkStatusSchema,
} from "@/lib/village/network-api";
import { readVillageGroup, saveVillageGroup } from "@/lib/village/settings";
import { saveVillageKeys } from "@/platform/village/settings";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postConsent } from "./consent/route";
import { POST as postLinkedin } from "./linkedin/route";
import { POST as postPaths } from "./paths/route";
import { POST as postSearch } from "./search/route";
import { POST as postStatus } from "./status/route";

const APP_URL = "http://localhost:3000";
const INVITE_LINK = "https://village.test/join/stored-invite";
const JOIN_PATH = "/v2/groups/join";
const TOKEN_PATH = "/v2/auth/tokens";
const SEARCH_PATH = "/v2/people/search";
const PATHS_PATH = "/v2/people/paths";
const TARGET_SLUG = "target-person";
const TARGET_URL = `https://www.linkedin.com/in/${TARGET_SLUG}`;
const UTC_DATE_LENGTH = 10;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function jsonRequest(member: Member | null, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Request(`${APP_URL}/api/network`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: APP_URL,
      ...(member ? { Cookie: member.cookie } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

describe("the member network API", () => {
  const database = createTestDatabase();
  let village: Awaited<ReturnType<typeof startFakeVillageServer>>;

  async function readExternalId(member: Member) {
    const [network] = await database
      .select()
      .from(memberNetwork)
      .where(eq(memberNetwork.userId, member.userId));
    if (!network) throw new Error("The member has no network row.");
    return network.villageExternalId;
  }

  async function readStatus(member: Member) {
    return networkStatusSchema.parse(await (await postStatus(jsonRequest(member, {}))).json());
  }

  async function createMemberWithLinkedin(slug: string, role: "admin" | "user" = "user") {
    const member = await createSignedInMember(database, role);
    const response = await postLinkedin(
      jsonRequest(member, { linkedinUrl: `https://www.linkedin.com/in/${slug}` }),
    );
    expect(response.status).toBe(200);
    return member;
  }

  async function createJoinedMember(slug: string) {
    const member = await createMemberWithLinkedin(slug);
    await postConsent(jsonRequest(member, { acknowledged: true }));
    await readStatus(member);
    village.state.linkedMembers.set(await readExternalId(member), { isSynced: true });
    expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.ready);
    return member;
  }

  beforeAll(async () => {
    village = await startFakeVillageServer();
    process.env.VILLAGE_API_URL = village.url;
    process.env.VILLAGE_SDK_URL = "https://sdk.village.test";
  });

  afterAll(async () => {
    delete process.env.VILLAGE_API_URL;
    delete process.env.VILLAGE_SDK_URL;
    await village.stop();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    village.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("without a session", () => {
    it.each([
      ["status", postStatus],
      ["linkedin", postLinkedin],
      ["consent", postConsent],
      ["search", postSearch],
      ["paths", postPaths],
    ])("rejects %s with 401", async (_name, post) => {
      const response = await post(jsonRequest(null, {}));

      expect(response.status).toBe(401);
    });
  });

  describe("the status stages", () => {
    it("reports not_configured before an admin saves keys", async () => {
      const member = await createSignedInMember(database);

      expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.notConfigured);
    });

    describe("once keys are saved", () => {
      beforeEach(async () => {
        await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
      });

      it("asks for a LinkedIn URL first", async () => {
        const member = await createSignedInMember(database);

        expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.needsLinkedin);
      });

      it("holds members until the admin creates a group", async () => {
        const member = await createMemberWithLinkedin("member-a");

        expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.awaitingGroup);
      });

      it("sends an admin with no group to sync, then to group creation", async () => {
        const admin = await createMemberWithLinkedin("admin-a", "admin");

        expect((await readStatus(admin)).stage).toBe(NETWORK_STAGES.needsSync);

        village.state.linkedMembers.set(await readExternalId(admin), { isSynced: true });

        expect((await readStatus(admin)).stage).toBe(NETWORK_STAGES.needsGroupCreation);
      });

      describe("with a group", () => {
        beforeEach(async () => {
          await saveVillageGroup(database, { id: "group-1", inviteLink: INVITE_LINK });
        });

        it("asks for consent before contacting Village", async () => {
          const member = await createMemberWithLinkedin("member-a");

          expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.needsConsent);
          expect(village.readRequests(TOKEN_PATH)).toEqual([]);
        });

        it("refuses consent that isn't explicit", async () => {
          const member = await createMemberWithLinkedin("member-a");

          const response = await postConsent(jsonRequest(member, { acknowledged: false }));

          expect(response.status).toBe(422);
          expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.needsConsent);
        });

        it("reports an unlinked member from a Village 404 and gives the SDK what it needs", async () => {
          const member = await createMemberWithLinkedin("member-a");
          await postConsent(jsonRequest(member, { acknowledged: true }));

          const status = await readStatus(member);

          expect(status.stage).toBe(NETWORK_STAGES.needsSync);
          expect(status.sync).toEqual({
            publicKey: FAKE_VILLAGE_KEYS.publicKey,
            externalId: await readExternalId(member),
            sdkUrl: "https://sdk.village.test",
          });
        });

        it("reports syncing until Village says the sync is complete", async () => {
          const member = await createMemberWithLinkedin("member-a");
          await postConsent(jsonRequest(member, { acknowledged: true }));
          await readStatus(member);
          const externalId = await readExternalId(member);
          village.state.linkedMembers.set(externalId, { isSynced: false });

          expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.syncing);
          expect(village.readRequests(JOIN_PATH)).toEqual([]);
        });

        it("joins the group once, after consent and sync", async () => {
          const member = await createJoinedMember("member-a");

          expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.ready);
          expect(village.readRequests(JOIN_PATH).map(({ body }) => body)).toEqual([
            { group_invite_link: INVITE_LINK },
          ]);
        });

        it("treats an already-joined member as joined", async () => {
          const member = await createMemberWithLinkedin("member-a");
          await postConsent(jsonRequest(member, { acknowledged: true }));
          await readStatus(member);
          const externalId = await readExternalId(member);
          village.state.linkedMembers.set(externalId, { isSynced: true });
          village.state.joinedMembers.add(externalId);

          expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.ready);
        });

        it("leaves a member unjoined when the join fails, and recovers", async () => {
          const member = await createMemberWithLinkedin("member-a");
          await postConsent(jsonRequest(member, { acknowledged: true }));
          await readStatus(member);
          village.state.linkedMembers.set(await readExternalId(member), { isSynced: true });
          village.state.failures.set(JOIN_PATH, { status: 500, type: "internal_error" });
          vi.spyOn(console, "error").mockImplementation(() => undefined);

          const failed = await postStatus(jsonRequest(member, {}));
          village.state.failures.delete(JOIN_PATH);

          expect(failed.status).toBe(502);
          expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.ready);
        });
      });
    });
  });

  describe("the Village identity", () => {
    beforeEach(async () => {
      await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
      await saveVillageGroup(database, { id: "group-1", inviteLink: INVITE_LINK });
    });

    it("uses an opaque UUID as the external reference, never the email", async () => {
      const member = await createMemberWithLinkedin("member-a");
      await postConsent(jsonRequest(member, { acknowledged: true }));

      await readStatus(member);

      const [mint] = village.readRequests(TOKEN_PATH);
      expect(mint?.body).toEqual({ external_user_id: await readExternalId(member), email: member.email });
      expect(await readExternalId(member)).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("never forwards the SDK's village.token cookie to Village", async () => {
      const member = await createJoinedMember("member-a");
      const cookie = `${member.cookie}; village.token=sdk-session-token`;

      await postStatus(jsonRequest(member, {}, { Cookie: cookie }));

      const leakedRequest = village.state.requests.find((request) =>
        JSON.stringify(request).includes("sdk-session-token"),
      );
      expect(leakedRequest).toBeUndefined();
    });

    it("returns no secret or token to the browser", async () => {
      const member = await createMemberWithLinkedin("member-a");
      await postConsent(jsonRequest(member, { acknowledged: true }));

      const body = await (await postStatus(jsonRequest(member, {}))).text();

      expect(body).not.toContain(FAKE_VILLAGE_KEYS.secretKey);
      expect(body).not.toContain("fake-token");
      expect(body).not.toContain(INVITE_LINK);
    });
  });

  describe("the LinkedIn URL", () => {
    it("stores the normalized slug", async () => {
      const member = await createSignedInMember(database);

      await postLinkedin(jsonRequest(member, { linkedinUrl: "linkedin.com/in/Jane-Doe/?trk=1" }));

      const [network] = await database
        .select()
        .from(memberNetwork)
        .where(eq(memberNetwork.userId, member.userId));
      expect(network?.linkedinSlug).toBe("jane-doe");
    });

    it("refuses a URL that isn't a LinkedIn profile", async () => {
      const member = await createSignedInMember(database);

      const response = await postLinkedin(jsonRequest(member, { linkedinUrl: "https://evil.test/in/x" }));

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.linkedinInvalid });
    });

    it("refuses a profile another member already claimed", async () => {
      await createMemberWithLinkedin("jane-doe");
      const secondMember = await createSignedInMember(database);

      const response = await postLinkedin(
        jsonRequest(secondMember, { linkedinUrl: "https://linkedin.com/in/JANE-DOE" }),
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.linkedinTaken });
    });

    it("lets a member save the same profile again", async () => {
      const member = await createMemberWithLinkedin("jane-doe");

      const response = await postLinkedin(
        jsonRequest(member, { linkedinUrl: "https://linkedin.com/in/jane-doe" }),
      );

      expect(response.status).toBe(200);
    });
  });

  describe("with a joined member", () => {
    let member: Member;

    beforeEach(async () => {
      await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
      await saveVillageGroup(database, { id: "group-1", inviteLink: INVITE_LINK });
      member = await createJoinedMember("searching-member");
    });

    function readTodayUsage() {
      const today = new Date().toISOString().slice(0, UTC_DATE_LENGTH);
      return database
        .select()
        .from(memberDailyUsage)
        .where(and(eq(memberDailyUsage.userId, member.userId), eq(memberDailyUsage.usageDate, today)));
    }

    async function search(prompt = "founders") {
      return postSearch(jsonRequest(member, { prompt }));
    }

    async function readSearch() {
      return networkSearchResultSchema.parse(await (await search()).json());
    }

    async function readPaths(slug = TARGET_SLUG, reader = member) {
      const response = await postPaths(jsonRequest(reader, { linkedinSlug: slug }));
      return networkPathsSchema.parse(await response.json());
    }

    describe("searching", () => {
      it("searches the member's own network scope", async () => {
        await search("climate investors");

        expect(village.readRequests(SEARCH_PATH).map(({ body }) => body)).toEqual([
          { prompt: "climate investors", scope: "network" },
        ]);
      });

      it("discards results when Village falls through to global", async () => {
        village.state.searchPeople = [{ full_name: "Global Person", linkedin_url: TARGET_URL }];
        village.state.searchSource = "global";

        const result = await readSearch();

        expect(result.people).toEqual([]);
        expect(result.discardedOffNetworkResults).toBe(true);
      });

      it("ranks community members first and badges them", async () => {
        await createJoinedMember("another-member");
        village.state.searchPeople = [
          { full_name: "Stranger", linkedin_url: TARGET_URL },
          { full_name: "Test Member", linkedin_url: "https://LinkedIn.com/in/Another-Member/" },
        ];

        const result = await readSearch();

        expect(result.people.map(({ fullName, isMember }) => [fullName, isMember])).toEqual([
          ["Test Member", true],
          ["Stranger", false],
        ]);
      });

      it("doesn't badge someone who hasn't joined", async () => {
        const unjoinedMember = await createSignedInMember(database);
        await postLinkedin(
          jsonRequest(unjoinedMember, { linkedinUrl: "https://linkedin.com/in/not-joined" }),
        );
        village.state.searchPeople = [
          { full_name: "Not Joined", linkedin_url: "https://linkedin.com/in/not-joined" },
        ];

        const result = await readSearch();

        expect(result.people[0]?.isMember).toBe(false);
      });

      it("refuses to search for a member who hasn't joined", async () => {
        const unjoinedMember = await createMemberWithLinkedin("not-joined");

        const response = await postSearch(jsonRequest(unjoinedMember, { prompt: "founders" }));

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.notReady });
        expect(village.readRequests(SEARCH_PATH)).toEqual([]);
      });
    });

    describe("reading paths", () => {
      const INTRODUCER = { first_name: "Intro", last_name: "Ducer", linkedin_url: "https://linkedin.com/in/introducer" };
      const MEMBER_INTRODUCER = { first_name: "Test", last_name: "Member", linkedin_url: "https://www.linkedin.com/in/Fellow-Member/" };

      it("marks member introducers and ranks their paths first", async () => {
        await createJoinedMember("fellow-member");
        village.state.pathsByUrl.set(TARGET_URL, {
          summary: "🟡 Intro can intro",
          paths: [
            { degree: 2, description: "via stranger", introducer: INTRODUCER },
            { degree: 2, description: "via member", introducer: MEMBER_INTRODUCER },
          ],
        });

        const result = await readPaths();

        expect(result.paths.map(({ description, involvesMember }) => [description, involvesMember])).toEqual([
          ["via member", true],
          ["via stranger", false],
        ]);
        expect(result.paths[0]?.introducer?.isMember).toBe(true);
      });

      it("marks member starters", async () => {
        await createJoinedMember("fellow-member");
        village.state.pathsByUrl.set(TARGET_URL, {
          summary: "summary",
          paths: [{ degree: 3, description: "team", introducer: INTRODUCER, starter: MEMBER_INTRODUCER }],
        });

        const result = await readPaths();

        expect(result.paths[0]?.starters[0]?.isMember).toBe(true);
      });

      it("replaces the Direct connection label for a member target", async () => {
        await createJoinedMember("fellow-member");
        const memberUrl = "https://www.linkedin.com/in/fellow-member";
        village.state.pathsByUrl.set(memberUrl, {
          summary: "🟢 Direct connection",
          paths: [{ degree: 1, description: "🟢 Direct connection", introducer: MEMBER_INTRODUCER }],
        });

        const result = await readPaths("fellow-member");

        expect(result.isTargetMember).toBe(true);
        expect(result.summary).toBe("Community member");
        expect(result.paths[0]?.description).toBe("Community member");
      });

      it("keeps the Direct connection label for someone outside the community", async () => {
        village.state.pathsByUrl.set(TARGET_URL, {
          summary: "🟢 Direct connection",
          paths: [{ degree: 1, description: "🟢 Direct connection", introducer: INTRODUCER }],
        });

        const result = await readPaths();

        expect(result.isTargetMember).toBe(false);
        expect(result.paths[0]?.description).toBe("🟢 Direct connection");
      });

      it("doesn't call the member a community member on their own paths", async () => {
        village.state.pathsByUrl.set(TARGET_URL, {
          summary: "summary",
          paths: [
            {
              degree: 2,
              description: "via me",
              introducer: { first_name: "Me", last_name: "Myself", linkedin_url: "https://linkedin.com/in/searching-member" },
            },
          ],
        });

        const result = await readPaths();

        expect(result.paths[0]?.introducer?.isMember).toBe(false);
      });

      it("shows no paths when Village has none", async () => {
        const result = await readPaths("nobody-knows-them");

        expect(result.paths).toEqual([]);
      });

      it("explains the unsynced state from a Village 409", async () => {
        village.state.isPathsNotSynced = true;

        const response = await postPaths(jsonRequest(member, { linkedinSlug: TARGET_SLUG }));

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
          code: NETWORK_ERROR_CODES.notSynced,
          message: expect.stringContaining("still syncing"),
        });
      });

      describe("caching", () => {
        beforeEach(() => {
          village.state.pathsByUrl.set(TARGET_URL, {
            summary: "summary",
            paths: [{ degree: 2, description: "via stranger", introducer: INTRODUCER }],
          });
        });

        it("serves the second read from the cache without a paths call or using the limit", async () => {
          const first = await readPaths();
          const usageAfterFirstRead = await readTodayUsage();

          const second = await readPaths();

          expect(first.isCached).toBe(false);
          expect(second.isCached).toBe(true);
          expect(second.paths).toEqual(first.paths);
          expect(village.readRequests(PATHS_PATH)).toHaveLength(1);
          expect(await readTodayUsage()).toEqual(usageAfterFirstRead);
        });

        it("keeps each member's cache separate", async () => {
          const secondMember = await createJoinedMember("second-member");
          await readPaths();

          const result = await readPaths(TARGET_SLUG, secondMember);

          expect(result.isCached).toBe(false);
          expect(village.readRequests(PATHS_PATH)).toHaveLength(2);
        });

        it("caches an empty result", async () => {
          await readPaths("nobody-knows-them");

          const result = await readPaths("nobody-knows-them");

          expect(result.isCached).toBe(true);
          expect(village.readRequests(PATHS_PATH)).toHaveLength(1);
        });

        it("refreshes an expired result", async () => {
          await readPaths();
          const longAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
          await database
            .update(memberPathResult)
            .set({ fetchedAt: longAgo })
            .where(eq(memberPathResult.userId, member.userId));

          const result = await readPaths();

          expect(result.isCached).toBe(false);
        });

        it("reflects a member who joined after the result was cached", async () => {
          village.state.pathsByUrl.set(TARGET_URL, {
            summary: "summary",
            paths: [{ degree: 2, description: "via member", introducer: MEMBER_INTRODUCER }],
          });
          const before = await readPaths();
          await createJoinedMember("fellow-member");

          const after = await readPaths();

          expect(before.paths[0]?.involvesMember).toBe(false);
          expect(after.isCached).toBe(true);
          expect(after.paths[0]?.involvesMember).toBe(true);
        });
      });
    });

    describe("the daily limit", () => {
      async function useWholeLimit() {
        const [usage] = await readTodayUsage();
        const usageDate = new Date().toISOString().slice(0, UTC_DATE_LENGTH);
        if (usage) throw new Error("The test expected no usage yet.");
        await database
          .insert(memberDailyUsage)
          .values({ userId: member.userId, usageDate, callCount: DAILY_LOOKUP_LIMITS.default });
      }

      it("counts each search", async () => {
        await search();
        await search();

        expect((await readTodayUsage())[0]?.callCount).toBe(2);
      });

      it("refuses searches past the limit without calling Village", async () => {
        await useWholeLimit();

        const response = await search();

        expect(response.status).toBe(429);
        expect(await response.json()).toMatchObject({
          code: NETWORK_ERROR_CODES.dailyLimitReached,
          message: expect.stringContaining(String(DAILY_LOOKUP_LIMITS.default)),
        });
        expect(village.readRequests(SEARCH_PATH)).toEqual([]);
      });

      it("refuses uncached paths past the limit without calling Village", async () => {
        await useWholeLimit();

        const response = await postPaths(jsonRequest(member, { linkedinSlug: TARGET_SLUG }));

        expect(response.status).toBe(429);
        expect(village.readRequests(PATHS_PATH)).toEqual([]);
      });

      it("keeps serving cached paths past the limit", async () => {
        await readPaths();
        await database
          .update(memberDailyUsage)
          .set({ callCount: DAILY_LOOKUP_LIMITS.default })
          .where(eq(memberDailyUsage.userId, member.userId));

        const response = await postPaths(jsonRequest(member, { linkedinSlug: TARGET_SLUG }));

        expect(response.status).toBe(200);
      });

      it("gives the call back when Village fails", async () => {
        village.state.failures.set(SEARCH_PATH, { status: 500, type: "internal_error" });
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        await search();

        expect((await readTodayUsage())[0]?.callCount).toBe(0);
      });

      it("holds under concurrent calls", async () => {
        const usageDate = new Date().toISOString().slice(0, UTC_DATE_LENGTH);
        await database
          .insert(memberDailyUsage)
          .values({ userId: member.userId, usageDate, callCount: DAILY_LOOKUP_LIMITS.default - 1 });

        const responses = await Promise.all([search("one"), search("two"), search("three")]);

        expect(responses.map(({ status }) => status).toSorted()).toEqual([200, 429, 429]);
      });
    });

    describe("when Village fails", () => {
      it.each([
        [401, NETWORK_ERROR_CODES.keysRejected],
        [402, NETWORK_ERROR_CODES.outOfCredits],
        [403, NETWORK_ERROR_CODES.notLinked],
        [429, NETWORK_ERROR_CODES.rateLimited],
        [500, NETWORK_ERROR_CODES.unavailable],
        [503, NETWORK_ERROR_CODES.unavailable],
      ])("turns a %i into the friendly %s error", async (status, code) => {
        village.state.failures.set(SEARCH_PATH, { status, type: "failure" });
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        const response = await search();

        expect(await response.json()).toMatchObject({ code });
      });

      it("logs the status and path without tokens or keys", async () => {
        village.state.failures.set(SEARCH_PATH, { status: 500, type: "internal_error" });
        const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await search();

        const output = JSON.stringify(logged.mock.calls);
        expect(output).toContain(`\\"status\\":500`);
        expect(output).toContain(SEARCH_PATH);
        expect(output).toContain("trace_fake");
        expect(output).not.toContain("fake-token");
        expect(output).not.toContain(FAKE_VILLAGE_KEYS.secretKey);
      });

      it("hides raw failures when Village is unreachable", async () => {
        const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const previousUrl = process.env.VILLAGE_API_URL;
        process.env.VILLAGE_API_URL = "http://127.0.0.1:9";

        const response = await search();
        process.env.VILLAGE_API_URL = previousUrl;

        expect(response.status).toBe(502);
        expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.unavailable });
        expect(JSON.stringify(logged.mock.calls)).toContain("unreachable");
      });

      it("keeps the group settings when a call fails", async () => {
        village.state.failures.set(SEARCH_PATH, { status: 500, type: "internal_error" });
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        await search();

        expect(await readVillageGroup(database)).toEqual({ id: "group-1", inviteLink: INVITE_LINK });
      });
    });
  });
});
