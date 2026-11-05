import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NETWORK_ERROR_CODES, networkStatusSchema, NETWORK_STAGES } from "@/lib/village/network-api";
import { readVillageGroup } from "@/lib/village/settings";
import { readVillageKeys, saveVillageKeys } from "@/platform/village/settings";
import { memberNetwork } from "@/modules/members/schema";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postLinkedin } from "@/app/api/network/linkedin/route";
import { POST as postStatus } from "@/app/api/network/status/route";
import { POST as postGroup } from "./group/route";
import { POST as postKeys } from "./keys/route";

const APP_URL = "http://localhost:3000";
const GROUP_PATH = "/v2/groups";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function jsonRequest(member: Member | null, body: unknown) {
  return new Request(`${APP_URL}/api/admin/village`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: APP_URL,
      ...(member ? { Cookie: member.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("the Village admin API", () => {
  const database = createTestDatabase();
  let village: Awaited<ReturnType<typeof startFakeVillageServer>>;

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("access", () => {
    it.each([
      ["keys", postKeys],
      ["group", postGroup],
    ])("refuses %s without a session", async (_name, post) => {
      expect((await post(jsonRequest(null, {}))).status).toBe(401);
    });

    it.each([
      ["keys", postKeys],
      ["group", postGroup],
    ])("refuses %s for a member who isn't an admin", async (_name, post) => {
      const member = await createSignedInMember(database);

      expect((await post(jsonRequest(member, {}))).status).toBe(403);
    });
  });

  describe("creating the group with a mismatched Village account", () => {
    it("tells the admin they can approve it themselves", async () => {
      const admin = await createSignedInMember(database, "admin");
      await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
      await postLinkedin(jsonRequest(admin, { linkedinUrl: "https://www.linkedin.com/in/avery-admin" }));
      const [network] = await database.select().from(memberNetwork);
      if (!network) throw new Error("The member network row is missing.");
      village.state.linkedMembers.set(network.villageExternalId, { isSynced: true, email: "other@example.com" });

      const response = await postGroup(jsonRequest(admin, { name: "Group", acknowledged: true }));

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        code: NETWORK_ERROR_CODES.linkMismatch,
        message: expect.stringContaining("Approve it under Admin, Members"),
      });
    });
  });

  describe("saving keys", () => {
    it("stores keys Village accepts and returns neither", async () => {
      const admin = await createSignedInMember(database, "admin");

      const response = await postKeys(jsonRequest(admin, FAKE_VILLAGE_KEYS));
      const responseBody = await response.text();

      expect(response.status).toBe(200);
      expect(responseBody).not.toContain(FAKE_VILLAGE_KEYS.secretKey);
      expect(await readVillageKeys(database)).toEqual(FAKE_VILLAGE_KEYS);
    });

    it("rejects a secret key Village refuses", async () => {
      const admin = await createSignedInMember(database, "admin");
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await postKeys(
        jsonRequest(admin, { publicKey: FAKE_VILLAGE_KEYS.publicKey, secretKey: "sk_wrong" }),
      );

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.keysRejected });
      expect(await readVillageKeys(database)).toBeNull();
    });

    it("rejects a public key from another app", async () => {
      const admin = await createSignedInMember(database, "admin");

      const response = await postKeys(
        jsonRequest(admin, { publicKey: "pk_other", secretKey: FAKE_VILLAGE_KEYS.secretKey }),
      );

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.keysMismatched });
      expect(await readVillageKeys(database)).toBeNull();
    });

    it("explains a Village outage without saving", async () => {
      const admin = await createSignedInMember(database, "admin");
      village.state.failures.set("/v2/auth/tokens", { status: 500, type: "internal_error" });
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await postKeys(jsonRequest(admin, FAKE_VILLAGE_KEYS));

      expect(response.status).toBe(502);
      expect(await readVillageKeys(database)).toBeNull();
    });
  });

  describe("creating the group", () => {
    const GROUP_REQUEST = { name: "Fund Network", acknowledged: true };

    async function createConnectedAdmin(isSynced: boolean) {
      const admin = await createSignedInMember(database, "admin");
      await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
      await postLinkedin(jsonRequest(admin, { linkedinUrl: "https://linkedin.com/in/fund-admin" }));
      await postStatus(jsonRequest(admin, {}));
      const [network] = await database.select().from(memberNetwork);
      if (!network) throw new Error("The admin has no network row.");
      village.state.linkedMembers.set(network.villageExternalId, { isSynced });
      return admin;
    }

    it("requires the explicit acknowledgement", async () => {
      const admin = await createConnectedAdmin(true);

      const response = await postGroup(jsonRequest(admin, { name: "Fund Network", acknowledged: false }));

      expect(response.status).toBe(422);
      expect(village.readRequests(GROUP_PATH)).toEqual([]);
    });

    it("refuses before the admin's account is synced", async () => {
      const admin = await createConnectedAdmin(false);

      const response = await postGroup(jsonRequest(admin, GROUP_REQUEST));

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.notReady });
      expect(village.readRequests(GROUP_PATH)).toEqual([]);
    });

    it("refuses without keys", async () => {
      const admin = await createSignedInMember(database, "admin");

      const response = await postGroup(jsonRequest(admin, GROUP_REQUEST));

      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.notConfigured });
    });

    it("stores the invite link without returning it", async () => {
      const admin = await createConnectedAdmin(true);

      const response = await postGroup(jsonRequest(admin, GROUP_REQUEST));
      const responseBody = await response.text();

      expect(response.status).toBe(200);
      expect(responseBody).not.toContain(village.state.inviteLink);
      expect(await readVillageGroup(database)).toEqual({
        id: "group-1",
        inviteLink: village.state.inviteLink,
      });
    });

    it("makes the creator a joined member who needs no second consent", async () => {
      const admin = await createConnectedAdmin(true);

      await postGroup(jsonRequest(admin, GROUP_REQUEST));

      const status = networkStatusSchema.parse(await (await postStatus(jsonRequest(admin, {}))).json());
      expect(status.stage).toBe(NETWORK_STAGES.ready);
      expect(village.readRequests("/v2/groups/join")).toEqual([]);
    });

    it("refuses a second group", async () => {
      const admin = await createConnectedAdmin(true);
      await postGroup(jsonRequest(admin, GROUP_REQUEST));

      const response = await postGroup(jsonRequest(admin, GROUP_REQUEST));

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: NETWORK_ERROR_CODES.groupExists });
      expect(village.state.createdGroups).toEqual([GROUP_REQUEST.name]);
    });
  });
});
