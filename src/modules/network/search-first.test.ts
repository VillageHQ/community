import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { memberNetwork } from "@/modules/members/schema";
import { NETWORK_ERROR_CODES, NETWORK_STAGES, networkPathsSchema, networkSearchResultSchema, networkStatusSchema } from "@/modules/network/contract";
import { saveVillageGroup } from "@/modules/network/service-settings";
import { INSTANCE_SETTING_KEYS } from "@/platform/settings/schema";
import { saveSettings } from "@/platform/settings/store";
import { saveVillageKeys } from "@/platform/village/settings";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postConsent } from "@/app/api/network/consent/route";
import { POST as postLeave } from "@/app/api/network/leave/route";
import { POST as postLinkedin } from "@/app/api/network/linkedin/route";
import { POST as postPaths } from "@/app/api/network/paths/route";
import { POST as postSearch } from "@/app/api/network/search/route";
import { POST as postStatus } from "@/app/api/network/status/route";

const APP_URL = "http://localhost:3000";
const SEARCH_IDENTITY = "community-pooled-search";
const GROUP = { id: "group-1", inviteLink: "https://village.test/join/stored-invite" };
const TARGET_SLUG = "target-person";
const TARGET_URL = `https://www.linkedin.com/in/${TARGET_SLUG}`;
const SEARCH_PATH = "/v2/people/search";
const PATHS_PATH = "/v2/people/paths";
const JOIN_PATH = "/v2/groups/join";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function jsonRequest(member: Member, body: unknown) {
  return new Request(`${APP_URL}/api/network`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
    body: JSON.stringify(body),
  });
}

function profile(firstName: string, slug: string) {
  return { first_name: firstName, last_name: "Member", linkedin_url: `https://linkedin.com/in/${slug}` };
}

function readCaller(headers: Record<string, string | string[] | undefined>) {
  return String(headers.authorization ?? "").replace("Bearer fake-token.", "");
}

describe("searching before connecting your own network", () => {
  const database = createTestDatabase();
  let village: Awaited<ReturnType<typeof startFakeVillageServer>>;

  async function readExternalId(member: Member) {
    const [network] = await database.select().from(memberNetwork).where(eq(memberNetwork.userId, member.userId));
    if (!network) throw new Error("The member has no network row.");
    return network.villageExternalId;
  }

  async function readStatus(member: Member) {
    return networkStatusSchema.parse(await (await postStatus(jsonRequest(member, {}))).json());
  }

  async function addLinkedin(member: Member, slug: string) {
    expect((await postLinkedin(jsonRequest(member, { linkedinUrl: `https://www.linkedin.com/in/${slug}` }))).status).toBe(200);
  }

  async function connect(member: Member, slug: string) {
    await addLinkedin(member, slug);
    await postConsent(jsonRequest(member, { acknowledged: true }));
    await readStatus(member);
    village.state.linkedMembers.set(await readExternalId(member), { status: "ready" });
    expect((await readStatus(member)).stage).toBe(NETWORK_STAGES.ready);
  }

  async function search(member: Member) {
    const response = await postSearch(jsonRequest(member, { prompt: "fintech founders" }));
    return { status: response.status, body: await response.json() };
  }

  async function readPaths(member: Member) {
    const response = await postPaths(jsonRequest(member, { linkedinSlug: TARGET_SLUG }));
    expect(response.status).toBe(200);
    return networkPathsSchema.parse(await response.json());
  }

  beforeAll(async () => {
    village = await startFakeVillageServer();
    process.env.VILLAGE_API_URL = village.url;
    process.env.VILLAGE_APP_URL = "https://app.village.test";
  });

  afterAll(async () => {
    delete process.env.VILLAGE_API_URL;
    delete process.env.VILLAGE_APP_URL;
    await village.stop();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    village.reset();
    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    await saveVillageGroup(database, GROUP);
    await saveSettings(database, { [INSTANCE_SETTING_KEYS.villageServiceEmail]: "village@example.com" });
    village.state.searchPeople = [{ full_name: "Target Person", linkedin_url: TARGET_URL, headline: "Founder" }];
  });

  it("lets a brand-new member search the shared networks at once, as the app's search identity", async () => {
    const newcomer = await createSignedInMember(database);

    const status = await readStatus(newcomer);
    expect(status).toMatchObject({ stage: NETWORK_STAGES.needsLinkedin, canSearch: true });

    const { status: code, body } = await search(newcomer);
    expect(code).toBe(200);
    const result = networkSearchResultSchema.parse(body);
    expect(result.people.map(({ fullName }) => fullName)).toEqual(["Target Person"]);
    expect(result.includesOwnNetwork).toBe(false);

    expect(village.readRequests(SEARCH_PATH).map(({ headers }) => readCaller(headers))).toEqual([SEARCH_IDENTITY]);
    expect(village.state.mintedGrants.get(SEARCH_IDENTITY)).toBe("full");
    expect(village.state.mintedEmails.get(SEARCH_IDENTITY)).toBe("village@example.com");
    expect(village.state.joinedMembers.has(await readExternalId(newcomer))).toBe(false);

    await search(newcomer);
    expect(village.readRequests(JOIN_PATH).filter(({ headers }) => readCaller(headers) === SEARCH_IDENTITY)).toHaveLength(1);
  });

  it("shows paths only through members who shared, never through one who refused", async () => {
    const sharer = await createSignedInMember(database);
    await connect(sharer, "sharing-member");
    const refuser = await createSignedInMember(database);
    await addLinkedin(refuser, "refusing-member");
    expect((await readStatus(refuser)).stage).toBe(NETWORK_STAGES.needsConsent);
    const newcomer = await createSignedInMember(database);
    village.state.pathsByUrl.set(TARGET_URL, {
      summary: "s",
      paths: [
        { degree: 2, description: "via sharer", introducer: profile("Test", "sharing-member") },
        { degree: 2, description: "via refuser", introducer: profile("Test", "refusing-member") },
        { degree: 1, description: "direct", introducer: profile("Target", TARGET_SLUG) },
        { degree: 3, description: "outsider via refuser", introducer: profile("Out", "outsider"), starter: profile("Test", "refusing-member") },
        { degree: 3, description: "outsider via sharer", introducer: profile("Out", "outsider"), starter: profile("Test", "sharing-member") },
        { degree: 3, description: "refuser via sharer", introducer: profile("Test", "refusing-member"), starter: profile("Test", "sharing-member") },
      ],
    });

    const paths = await readPaths(newcomer);

    expect(paths.paths.map(({ description }) => description).toSorted()).toEqual(["outsider via sharer", "via sharer"]);
    expect(paths.connectors.map(({ member }) => member?.id)).toEqual([sharer.userId]);
    expect(JSON.stringify(paths)).not.toContain("refusing-member");
    expect(village.readRequests(PATHS_PATH).map(({ headers }) => readCaller(headers))).toEqual([SEARCH_IDENTITY]);
  });

  it("never names a member who refused, even to a member who connected, even as the contact a sharer goes through", async () => {
    const sharer = await createSignedInMember(database);
    await connect(sharer, "sharing-member");
    const refuser = await createSignedInMember(database);
    await addLinkedin(refuser, "refusing-member");
    const viewer = await createSignedInMember(database);
    await connect(viewer, "viewer-member");
    village.state.pathsByUrl.set(TARGET_URL, {
      summary: "s",
      paths: [
        { degree: 3, description: "refuser via sharer", introducer: profile("Test", "refusing-member"), starter: profile("Test", "sharing-member") },
        { degree: 2, description: "via my own contact", introducer: profile("Own", "own-contact") },
      ],
    });

    const paths = await readPaths(viewer);

    expect(paths.paths.map(({ description }) => description)).toEqual(["via my own contact"]);
    expect(JSON.stringify(paths)).not.toContain("refusing-member");
  });

  it("counts the member's own contacts once they connect, and forgets the paths found before", async () => {
    const sharer = await createSignedInMember(database);
    await connect(sharer, "sharing-member");
    const newcomer = await createSignedInMember(database);
    village.state.pathsByUrl.set(TARGET_URL, {
      summary: "s",
      paths: [{ degree: 2, description: "via sharer", introducer: profile("Test", "sharing-member") }],
    });
    expect((await readPaths(newcomer)).paths).toHaveLength(1);

    await connect(newcomer, "new-member");
    const ownId = await readExternalId(newcomer);
    village.state.pathsByCaller.set(ownId, new Map([[TARGET_URL, {
      summary: "s",
      paths: [
        { degree: 2, description: "via sharer", introducer: profile("Test", "sharing-member") },
        { degree: 2, description: "via my own contact", introducer: profile("Own", "own-contact") },
      ],
    }]]));

    const result = networkSearchResultSchema.parse((await search(newcomer)).body);
    expect(result.includesOwnNetwork).toBe(true);
    expect(readCaller(village.readRequests(SEARCH_PATH).at(-1)?.headers ?? {})).toBe(ownId);
    expect((await readPaths(newcomer)).paths.map(({ description }) => description).toSorted()).toEqual(["via my own contact", "via sharer"]);
  });

  it("says plainly when Village won't search the shared networks for someone who never synced", async () => {
    const newcomer = await createSignedInMember(database);
    village.state.isUnsyncedGroupSearchRefused = true;

    const { status, body } = await search(newcomer);

    expect(status).toBe(409);
    expect(body).toMatchObject({ code: NETWORK_ERROR_CODES.pooledSearchUnavailable });
  });

  it("keeps the gate where there is nothing to search yet: no group, or no Village", async () => {
    const newcomer = await createSignedInMember(database);
    await database.delete((await import("@/platform/settings/schema")).instanceSettings);

    expect(await readStatus(newcomer)).toMatchObject({ stage: NETWORK_STAGES.notConfigured, canSearch: false });
    // Without Village, search finds member profiles only (Founderhall's search with no key).
    expect(await search(newcomer)).toMatchObject({ status: 200, body: { isProfilesOnly: true, people: [] } });

    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    expect(await readStatus(newcomer)).toMatchObject({ canSearch: false });
    expect((await search(newcomer)).status).toBe(409);
  });

  it("lets the group's creator leave when only the search identity is left in it", async () => {
    const creator = await createSignedInMember(database, "admin");
    await connect(creator, "creator-member");
    const newcomer = await createSignedInMember(database);
    await search(newcomer);
    village.state.groupCreatorIds.add(await readExternalId(creator));
    village.state.isCreatorBlockedOnlyWithOthers = true;

    const response = await postLeave(jsonRequest(creator, { confirmed: true }));

    expect(response.status).toBe(200);
    expect(village.state.leftMembers.has(SEARCH_IDENTITY)).toBe(true);
  });
});
