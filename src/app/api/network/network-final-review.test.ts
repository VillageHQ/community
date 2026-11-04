import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { memberDailyUsage, memberNetwork, memberPathResult } from "@/database/village-schema";
import { readVillageLinks } from "@/lib/village/member-network";
import { NETWORK_ERROR_CODES, NETWORK_STAGES, networkStatusSchema } from "@/lib/village/network-api";
import { saveVillageGroup, saveVillageKeys } from "@/lib/village/settings";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postLinkReset } from "../admin/village/links/reset/route";
import { POST as postConsent } from "./consent/route";
import { POST as postLeave } from "./leave/route";
import { POST as postLinkedin } from "./linkedin/route";
import { POST as postPaths, maxDuration as pathsMaxDuration } from "./paths/route";
import { POST as postSearch, maxDuration as searchMaxDuration } from "./search/route";
import { POST as postStatus } from "./status/route";

const APP_URL = "http://localhost:3000";
const SEARCH_PATH = "/v2/people/search";
const PATHS_PATH = "/v2/people/paths";
const LEAVE_PATH = "/v2/groups/leave";
const TOKEN_PATH = "/v2/auth/tokens";
const USER_PATH = "/v2/user/me";
const MILLISECONDS_PER_SECOND = 1000;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function jsonRequest(member: Member, body: unknown) {
  return new Request(`${APP_URL}/api/network`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
    body: JSON.stringify(body),
  });
}

describe("the final review fixes", () => {
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

  async function createConsentedMember(slug: string) {
    const member = await createSignedInMember(database);
    await postLinkedin(jsonRequest(member, { linkedinUrl: `https://www.linkedin.com/in/${slug}` }));
    await postConsent(jsonRequest(member, { acknowledged: true }));
    return member;
  }

  async function createJoinedMember(slug: string) {
    const member = await createConsentedMember(slug);
    await readStatus(member);
    village.state.linkedMembers.set((await readNetwork(member)).villageExternalId, {
      isSynced: true,
    });
    expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.ready);
    return member;
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
    await saveVillageGroup(database, { id: "group-1", inviteLink: "https://village.test/join/a" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("usage after an error that isn't Village's own JSON", () => {
    it.each([502, 504])("keeps the lookup on an HTML %i from search", async (status) => {
      const member = await createJoinedMember("spender");
      village.state.htmlFailureStatusByPath.set(SEARCH_PATH, status);

      const response = await postSearch(jsonRequest(member, { prompt: "founders" }));

      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.searchCutOff });
      expect(await readUsageCount(member)).toBe(1);
    });

    it("keeps the lookup on an HTML 502 from paths", async () => {
      const member = await createJoinedMember("spender");
      village.state.htmlFailureStatusByPath.set(PATHS_PATH, 502);

      await postPaths(jsonRequest(member, { linkedinSlug: "target" }));

      expect(await readUsageCount(member)).toBe(1);
    });

    it("refunds Village's own JSON 500", async () => {
      const member = await createJoinedMember("spender");
      village.state.failures.set(SEARCH_PATH, { status: 500, type: "internal_error" });

      await postSearch(jsonRequest(member, { prompt: "founders" }));

      expect(await readUsageCount(member)).toBe(0);
    });

    it("doesn't cache an HTML 404 from a proxy as no paths", async () => {
      const member = await createJoinedMember("spender");
      village.state.htmlFailureStatusByPath.set(PATHS_PATH, 404);

      const response = await postPaths(jsonRequest(member, { linkedinSlug: "target" }));

      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.unavailable });
      expect(await database.select().from(memberPathResult)).toEqual([]);
      expect(await readUsageCount(member)).toBe(1);
    });

    it("doesn't read an HTML 404 from /me as an unlinked member", async () => {
      const member = await createJoinedMember("spender");
      village.state.htmlFailureStatusByPath.set(USER_PATH, 404);

      const response = await postStatus(jsonRequest(member, {}));

      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.unavailable });
    });
  });

  describe("leaving when Village can't confirm it", () => {
    it("reports the member is still in the group when the link is gone", async () => {
      await createJoinedMember("stays-in-group");
      const member = await createJoinedMember("leaver");
      village.state.linkedMembers.delete((await readNetwork(member)).villageExternalId);

      const response = await postLeave(jsonRequest(member, { confirmed: true }));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body).toMatchObject({ code: NETWORK_ERROR_CODES.leaveNotConfirmed });
      expect(body.message).toContain("still a member");
      expect(body.message).toContain("Sync your network");
      expect((await readNetwork(member)).groupJoinedAt).not.toBeNull();
      expect(village.readRequests(LEAVE_PATH)).toEqual([]);
    });

    it("stays joined when the link disappears during the leave", async () => {
      const member = await createJoinedMember("leaver");
      village.state.isUnlinkedOnLeaveRequest = true;

      const response = await postLeave(jsonRequest(member, { confirmed: true }));

      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.leaveNotConfirmed });
      expect((await readNetwork(member)).groupJoinedAt).not.toBeNull();
    });

    it("stays joined on an HTML 404 from a proxy", async () => {
      const member = await createJoinedMember("leaver");
      village.state.htmlFailureStatusByPath.set(LEAVE_PATH, 404);

      const response = await postLeave(jsonRequest(member, { confirmed: true }));

      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.unavailable });
      expect((await readNetwork(member)).groupJoinedAt).not.toBeNull();
    });
  });

  describe("an admin resetting a member's Village link", () => {
    async function createAdmin() {
      return createSignedInMember(database, "admin");
    }

    it("rotates the UUID and clears link, consent, group status and cached paths", async () => {
      const member = await createJoinedMember("reset-me");
      await postPaths(jsonRequest(member, { linkedinSlug: "someone" }));
      const before = await readNetwork(member);
      const admin = await createAdmin();

      const response = await postLinkReset(
        jsonRequest(admin, { memberId: member.userId, confirmed: true }),
      );

      const after = await readNetwork(member);
      expect(response.status).toBe(200);
      expect(after.villageExternalId).not.toBe(before.villageExternalId);
      expect(after.villageExternalId).toMatch(/^[0-9a-f-]{36}$/);
      expect(after.sharingConsentedAt).toBeNull();
      expect(after.groupJoinedAt).toBeNull();
      expect(after.pendingVillageEmail).toBeNull();
      expect(after.approvedVillageEmail).toBeNull();
      expect(after.approvedMemberEmail).toBeNull();
      expect(after.linkedinSlug).toBe("reset-me");
      expect(await database.select().from(memberPathResult)).toEqual([]);
    });

    it("lets a locked-out member start again", async () => {
      const member = await createConsentedMember("wrong-account");
      await readStatus(member);
      village.state.linkedMembers.set((await readNetwork(member)).villageExternalId, {
        isSynced: true,
        email: "wrong@elsewhere.test",
      });
      expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.linkMismatch);
      const admin = await createAdmin();

      await postLinkReset(jsonRequest(admin, { memberId: member.userId, confirmed: true }));
      expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.needsConsent);
      await postConsent(jsonRequest(member, { acknowledged: true }));

      const status = await readStatus(member);
      expect(status.stage).toBe(NETWORK_STAGES.needsSync);
      expect(status.sync?.externalId).toBe((await readNetwork(member)).villageExternalId);
    });

    it("calls nothing on Village's side", async () => {
      const member = await createJoinedMember("reset-me");
      const admin = await createAdmin();
      const requestsBefore = village.state.requests.length;

      await postLinkReset(jsonRequest(admin, { memberId: member.userId, confirmed: true }));

      expect(village.state.requests).toHaveLength(requestsBefore);
    });

    it("lists members with a link so an admin can reach the action", async () => {
      const member = await createJoinedMember("reset-me");

      const links = await readVillageLinks(database);

      expect(links.map(({ memberId }) => memberId)).toEqual([member.userId]);
    });

    it("requires confirmation", async () => {
      const member = await createJoinedMember("reset-me");
      const admin = await createAdmin();

      const response = await postLinkReset(jsonRequest(admin, { memberId: member.userId }));

      expect(response.status).toBe(422);
      expect((await readNetwork(member)).groupJoinedAt).not.toBeNull();
    });

    it("refuses a member who isn't an admin", async () => {
      const member = await createJoinedMember("reset-me");
      const other = await createJoinedMember("other");

      const response = await postLinkReset(
        jsonRequest(other, { memberId: member.userId, confirmed: true }),
      );

      expect(response.status).toBe(403);
      expect((await readNetwork(member)).groupJoinedAt).not.toBeNull();
    });

    it("explains an unknown member", async () => {
      const admin = await createAdmin();

      const response = await postLinkReset(
        jsonRequest(admin, { memberId: "nobody", confirmed: true }),
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.memberNotFound });
    });
  });

  describe("a stale token", () => {
    it("drops the token on a Village 401 and re-mints once", async () => {
      const member = await createJoinedMember("poller");
      const mintsBefore = village.readRequests(TOKEN_PATH).length;
      village.state.bearerRejectionsLeft = 1;

      const status = await readStatus(member);

      expect(status.stage).toBe(NETWORK_STAGES.ready);
      expect(village.readRequests(TOKEN_PATH)).toHaveLength(mintsBefore + 1);
    });

    it("reuses the fresh token afterward", async () => {
      const member = await createJoinedMember("poller");
      village.state.bearerRejectionsLeft = 1;
      await readStatus(member);
      const mintsAfterRetry = village.readRequests(TOKEN_PATH).length;

      await readStatus(member);

      expect(village.readRequests(TOKEN_PATH)).toHaveLength(mintsAfterRetry);
    });

    it("gives up after one retry with the friendly key error", async () => {
      const member = await createJoinedMember("poller");
      const mintsBefore = village.readRequests(TOKEN_PATH).length;
      const userCallsBefore = village.readRequests(USER_PATH).length;
      village.state.bearerRejectionsLeft = 5;

      const response = await postStatus(jsonRequest(member, {}));

      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.keysRejected });
      expect(village.readRequests(TOKEN_PATH)).toHaveLength(mintsBefore + 1);
      expect(village.readRequests(USER_PATH)).toHaveLength(userCallsBefore + 2);
    });

    it("counts one lookup when a search retries after a 401", async () => {
      const member = await createJoinedMember("poller");
      const realFetch = globalThis.fetch;
      let isFirstSearch = true;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        if (String(input).endsWith(SEARCH_PATH) && isFirstSearch) {
          isFirstSearch = false;
          return Response.json({ error: { type: "authentication_error" } }, { status: 401 });
        }
        return realFetch(input, init);
      });

      const response = await postSearch(jsonRequest(member, { prompt: "founders" }));

      expect(response.status).toBe(200);
      expect(await readUsageCount(member)).toBe(1);
    });
  });

  describe("leaving before consent", () => {
    it("refuses before sending anything to Village", async () => {
      const member = await createSignedInMember(database);
      await postLinkedin(jsonRequest(member, { linkedinUrl: "https://linkedin.com/in/early" }));

      const response = await postLeave(jsonRequest(member, { confirmed: true }));

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.notReady });
      expect(village.state.requests).toEqual([]);
    });
  });

  describe("the shared deadline", () => {
    function spendTimeOnUserCall(seconds: number) {
      const realFetch = globalThis.fetch;
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const isUserCall = String(input).endsWith(USER_PATH);
        const response = await realFetch(input, init);
        if (isUserCall) vi.advanceTimersByTime(seconds * MILLISECONDS_PER_SECOND);
        return response;
      });
    }

    function recordTimeouts() {
      return vi.spyOn(AbortSignal, "timeout");
    }

    it("returns the friendly paths message before maxDuration, without calling paths", async () => {
      const member = await createJoinedMember("slow");
      spendTimeOnUserCall(pathsMaxDuration);

      const response = await postPaths(jsonRequest(member, { linkedinSlug: "target" }));

      expect(response.status).toBe(504);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.timedOut });
      expect(village.readRequests(PATHS_PATH)).toEqual([]);
    });

    it("returns the friendly search message before maxDuration, without calling search", async () => {
      const member = await createJoinedMember("slow");
      spendTimeOnUserCall(searchMaxDuration);

      const response = await postSearch(jsonRequest(member, { prompt: "founders" }));

      expect(response.status).toBe(504);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.searchCutOff });
      expect(village.readRequests(SEARCH_PATH)).toEqual([]);
    });

    it("gives a late paths call only the time that's left", async () => {
      const member = await createJoinedMember("slow");
      village.state.pathsByUrl.set("https://www.linkedin.com/in/target", {
        summary: "summary",
        paths: [],
      });
      spendTimeOnUserCall(30);
      const timeouts = recordTimeouts();

      await postPaths(jsonRequest(member, { linkedinSlug: "target" }));

      const longestRemainingMs = Math.max(...timeouts.mock.calls.map(([delay]) => delay));
      expect(longestRemainingMs).toBeLessThan((pathsMaxDuration - 30) * MILLISECONDS_PER_SECOND);
    });

    it("keeps the long search timeout workable when earlier calls are quick", async () => {
      const member = await createJoinedMember("slow");
      const timeouts = recordTimeouts();

      await postSearch(jsonRequest(member, { prompt: "founders" }));

      expect(Math.max(...timeouts.mock.calls.map(([delay]) => delay))).toBe(120_000);
    });

    it("gives a slow paths call its full step when earlier calls are quick", async () => {
      const member = await createJoinedMember("slow");
      const timeouts = recordTimeouts();

      await postPaths(jsonRequest(member, { linkedinSlug: "target" }));

      expect(Math.max(...timeouts.mock.calls.map(([delay]) => delay))).toBe(60_000);
    });
  });
});
