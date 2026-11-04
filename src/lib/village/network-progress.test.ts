import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { memberNetwork } from "@/database/village-schema";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { advanceNetwork, createNetworkContext } from "./member-network";
import { NETWORK_STAGES } from "./network-api";
import {
  NETWORK_PROGRESS,
  readNetworkProgress,
  readPendingLinkCount,
  readSharingMemberCount,
  readWelcomeNeighbours,
} from "./network-progress";
import { saveVillageGroup, saveVillageKeys } from "./settings";

const LINKEDIN_SLUG = "amara-osei";
const GROUP = { id: "group-1", inviteLink: "https://village.test/join/invite-code" };

describe("network progress", () => {
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

  async function expectAgreementWithStatus(role: "admin" | "user", expected: string) {
    const { userId, email } = await createSignedInMember(database, role);
    const member = { id: userId, email, role };
    if (expected !== NETWORK_STAGES.notConfigured) await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    return { member, status: () => advanceNetwork(createNetworkContext(database, process.env, member)) };
  }

  it.each([
    ["without keys", NETWORK_STAGES.notConfigured],
    ["before LinkedIn", NETWORK_STAGES.needsLinkedin],
  ])("agrees with the status route %s", async (_name, expected) => {
    const { member, status } = await expectAgreementWithStatus("user", expected);

    expect(await readNetworkProgress(database, member)).toBe(expected);
    expect((await status()).stage).toBe(expected);
  });

  it("agrees with the status route while the group is missing", async () => {
    const { member, status } = await expectAgreementWithStatus("user", NETWORK_STAGES.awaitingGroup);
    await database.insert(memberNetwork).values({ userId: member.id, linkedinSlug: LINKEDIN_SLUG });

    expect(await readNetworkProgress(database, member)).toBe(NETWORK_STAGES.awaitingGroup);
    expect((await status()).stage).toBe(NETWORK_STAGES.awaitingGroup);
  });

  it("agrees with the status route before consent, for a member who chose not now", async () => {
    const { member, status } = await expectAgreementWithStatus("user", NETWORK_STAGES.needsConsent);
    await database.insert(memberNetwork).values({ userId: member.id, linkedinSlug: LINKEDIN_SLUG });
    await saveVillageGroup(database, GROUP);

    expect(await readNetworkProgress(database, member)).toBe(NETWORK_STAGES.needsConsent);
    expect((await status()).stage).toBe(NETWORK_STAGES.needsConsent);
  });

  it("calls Village for nothing while reading progress", async () => {
    const { member } = await expectAgreementWithStatus("user", NETWORK_STAGES.needsLinkedin);
    await database.insert(memberNetwork).values({ userId: member.id, linkedinSlug: LINKEDIN_SLUG });
    await saveVillageGroup(database, GROUP);

    await readNetworkProgress(database, member);

    expect(village.state.requests).toEqual([]);
  });

  it("reports a consented member as still finishing the join", async () => {
    const { member } = await expectAgreementWithStatus("user", NETWORK_STAGES.needsSync);
    await database
      .insert(memberNetwork)
      .values({ userId: member.id, linkedinSlug: LINKEDIN_SLUG, sharingConsentedAt: new Date() });
    await saveVillageGroup(database, GROUP);

    expect(await readNetworkProgress(database, member)).toBe(NETWORK_PROGRESS.finishingJoin);
  });

  describe("with a Village email mismatch", () => {
    const OTHER_EMAIL = "someone-else@example.test";

    it("agrees with the status route once Village reports the other email", async () => {
      const { member, status } = await expectAgreementWithStatus("user", NETWORK_STAGES.linkMismatch);
      const now = new Date();
      const [network] = await database
        .insert(memberNetwork)
        .values({ userId: member.id, linkedinSlug: LINKEDIN_SLUG, sharingConsentedAt: now })
        .returning();
      await saveVillageGroup(database, GROUP);
      village.state.linkedMembers.set(network?.villageExternalId ?? "", { isSynced: true, email: OTHER_EMAIL });

      expect((await status()).stage).toBe(NETWORK_STAGES.linkMismatch);
      expect(await readNetworkProgress(database, member)).toBe(NETWORK_PROGRESS.needsApproval);
    });

    it("never tells a joined but blocked member they're in", async () => {
      const { member } = await expectAgreementWithStatus("user", NETWORK_STAGES.linkMismatch);
      const now = new Date();
      await database.insert(memberNetwork).values({
        userId: member.id,
        linkedinSlug: LINKEDIN_SLUG,
        sharingConsentedAt: now,
        groupJoinedAt: now,
        pendingVillageEmail: OTHER_EMAIL,
      });
      await saveVillageGroup(database, GROUP);

      expect(await readNetworkProgress(database, member)).toBe(NETWORK_PROGRESS.needsApproval);
    });
  });

  it("reports a joined member as ready", async () => {
    const { member } = await expectAgreementWithStatus("user", NETWORK_STAGES.ready);
    const now = new Date();
    await database
      .insert(memberNetwork)
      .values({ userId: member.id, linkedinSlug: LINKEDIN_SLUG, sharingConsentedAt: now, groupJoinedAt: now });
    await saveVillageGroup(database, GROUP);

    expect(await readNetworkProgress(database, member)).toBe(NETWORK_PROGRESS.ready);
  });

  describe("community counts", () => {
    it("counts only members who joined the group", async () => {
      const joined = await createSignedInMember(database);
      const skipped = await createSignedInMember(database);
      await database.insert(memberNetwork).values([
        { userId: joined.userId, groupJoinedAt: new Date() },
        { userId: skipped.userId },
      ]);

      expect(await readSharingMemberCount(database)).toBe(1);
    });

    it("shows a member only other members who joined", async () => {
      const joined = await createSignedInMember(database);
      const skipped = await createSignedInMember(database);
      const viewer = await createSignedInMember(database);
      await database.insert(memberNetwork).values([
        { userId: joined.userId, groupJoinedAt: new Date() },
        { userId: skipped.userId },
        { userId: viewer.userId, groupJoinedAt: new Date() },
      ]);

      const neighbours = await readWelcomeNeighbours(database, viewer.userId);

      expect(neighbours.map(({ id }) => id)).toEqual([joined.userId]);
    });

    it("counts Village links waiting for an admin", async () => {
      const pending = await createSignedInMember(database);
      await database.insert(memberNetwork).values({ userId: pending.userId, pendingVillageEmail: "other@example.test" });

      expect(await readPendingLinkCount(database)).toBe(1);
    });
  });
});
