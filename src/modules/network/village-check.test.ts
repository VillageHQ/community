import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MEMBER_CHECK_OUTCOMES, VILLAGE_CHECK_GROUP, VILLAGE_CHECK_KEYS } from "@/modules/network/contract-village-check";
import { OWN_VILLAGE_STATES, readOwnVillageState, readVillageCheck } from "@/modules/network/reads-village-check";
import { villageCheck } from "@/modules/network/schema";
import { saveVillageGroup } from "@/modules/network/service-settings";
import { memberNetwork } from "@/modules/members/schema";
import { saveVillageKeys } from "@/platform/village/settings";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postCheck } from "@/app/api/admin/village/check/route";

const APP_URL = "http://localhost:3000";
const GROUP = { id: "group-1", inviteLink: "https://village.test/join/invite-code" };
// Calls that spend Village credits. The check must never make one.
const PAID_PATH_PREFIXES = ["/v2/people", "/v2/companies"];

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function checkRequest(member: Member) {
  return new Request(`${APP_URL}/api/admin/village/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
    body: "{}",
  });
}

describe("the Village check", () => {
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

  // A member who reached Village through the join flow; returns their Village id.
  async function addStartedMember(member: Member) {
    const [network] = await database.insert(memberNetwork).values({ userId: member.userId, sharingConsentedAt: new Date() }).returning();
    if (!network) throw new Error("The member network row is missing.");
    return network.villageExternalId;
  }

  async function setUpCommunity() {
    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    await saveVillageGroup(database, GROUP);
    const admin = await createSignedInMember(database, "admin");
    const [connected, syncing, unlinked, notStarted] = [
      await createSignedInMember(database),
      await createSignedInMember(database),
      await createSignedInMember(database),
      await createSignedInMember(database),
    ];
    const connectedId = await addStartedMember(connected);
    village.state.linkedMembers.set(connectedId, { status: "ready" });
    village.state.joinedMembers.add(connectedId);
    const syncingId = await addStartedMember(syncing);
    village.state.linkedMembers.set(syncingId, { status: "syncing" });
    await addStartedMember(unlinked);
    return { admin, connected, syncing, unlinked, notStarted };
  }

  it("shows each member's Village user, connection and group, with free calls only", async () => {
    const { admin, connected, syncing, unlinked, notStarted } = await setUpCommunity();

    const response = await postCheck(checkRequest(admin));

    expect(response.status).toBe(200);
    const { check, members } = await readVillageCheck(database);
    expect(check).toMatchObject({ keys: VILLAGE_CHECK_KEYS.ok, group: VILLAGE_CHECK_GROUP.found, groupMemberCount: 1 });
    const byId = new Map(members.map((member) => [member.userId, member]));
    expect(byId.get(connected.userId)).toMatchObject({ outcome: MEMBER_CHECK_OUTCOMES.checked, isProvisioned: true, networkStatus: "ready", isInGroup: true });
    expect(byId.get(syncing.userId)).toMatchObject({ outcome: MEMBER_CHECK_OUTCOMES.checked, isProvisioned: true, networkStatus: "syncing", isInGroup: false });
    expect(byId.get(unlinked.userId)).toMatchObject({ outcome: MEMBER_CHECK_OUTCOMES.checked, isProvisioned: false, isInGroup: false });
    expect(byId.get(notStarted.userId)).toMatchObject({ outcome: MEMBER_CHECK_OUTCOMES.notStarted, isProvisioned: false });
    // The admin never started connecting either, so Village wasn't sent their email as a member.
    expect(byId.get(admin.userId)).toMatchObject({ outcome: MEMBER_CHECK_OUTCOMES.notStarted });

    const paths = village.state.requests.map(({ path }) => path);
    expect(paths.filter((path) => PAID_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)))).toEqual([]);
    expect(village.state.joinedMembers.size).toBe(1);
    const mintedEmails = [...village.state.mintedEmails.values()];
    expect(mintedEmails).not.toContain(notStarted.email);

    expect(await readOwnVillageState(database, connected.userId)).toMatchObject({ state: OWN_VILLAGE_STATES.connected });
    expect(await readOwnVillageState(database, syncing.userId)).toMatchObject({ state: OWN_VILLAGE_STATES.notConnected });
    expect(await readOwnVillageState(database, unlinked.userId)).toMatchObject({ state: OWN_VILLAGE_STATES.notConnected });
  });

  it("says the keys were rejected when Village refuses the secret key", async () => {
    const { admin, connected } = await setUpCommunity();
    await saveVillageKeys(database, { publicKey: FAKE_VILLAGE_KEYS.publicKey, secretKey: "sk_wrong" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect((await postCheck(checkRequest(admin))).status).toBe(200);

    const { check, members } = await readVillageCheck(database);
    expect(check).toMatchObject({ keys: VILLAGE_CHECK_KEYS.rejected });
    expect(members.find(({ userId }) => userId === connected.userId)).toMatchObject({ outcome: MEMBER_CHECK_OUTCOMES.unreachable });
    expect(await readOwnVillageState(database, connected.userId)).toBeNull();
    vi.restoreAllMocks();
  });

  it("runs at most once a minute", async () => {
    const { admin } = await setUpCommunity();

    expect((await postCheck(checkRequest(admin))).status).toBe(200);
    expect((await postCheck(checkRequest(admin))).status).toBe(429);

    await database.update(villageCheck).set({ startedAt: new Date(Date.now() - 61_000) }).where(eq(villageCheck.id, "latest"));
    expect((await postCheck(checkRequest(admin))).status).toBe(200);
  });

  it("is for admins only", async () => {
    const { connected } = await setUpCommunity();

    expect((await postCheck(checkRequest(connected))).status).toBe(403);
  });
});
