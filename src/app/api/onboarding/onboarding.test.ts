import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { memberProfile } from "@/database/members-schema";
import { memberNetwork } from "@/database/village-schema";
import { resolveOnboardingStep } from "@/lib/members/onboarding";
import { ONBOARDING_STEPS } from "@/lib/members/profile-api";
import { saveVillageGroup, saveVillageKeys } from "@/lib/village/settings";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_VILLAGE_KEYS } from "@/test/fake-village-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postProfile } from "@/app/api/profile/route";
import { POST as postOnboarding } from "./route";

const APP_URL = "http://localhost:3000";
const GROUP = { id: "group-1", inviteLink: "https://village.test/join/invite-code" };
const UNAUTHORIZED_STATUS = 401;
const UNPROCESSABLE_STATUS = 422;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

describe("onboarding", () => {
  const database = createTestDatabase();
  let member: Member;

  function sessionMember() {
    return { id: member.userId, email: member.email, role: "user" };
  }

  function readStep() {
    return resolveOnboardingStep(database, sessionMember());
  }

  function post(route: typeof postOnboarding, body: unknown, requester: Member | null = member) {
    return route(
      new Request(`${APP_URL}/api/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: APP_URL, ...(requester ? { Cookie: requester.cookie } : {}) },
        body: JSON.stringify(body),
      }),
    );
  }

  async function connectVillage() {
    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    await saveVillageGroup(database, GROUP);
  }

  beforeEach(async () => {
    await clearDatabase(database);
    member = await createSignedInMember(database);
    await database.insert(memberProfile).values({ userId: member.userId });
  });

  it("leaves out anyone who never accepted an invite, like the first admin", async () => {
    await database.delete(memberProfile).where(eq(memberProfile.userId, member.userId));

    expect(await readStep()).toBe(ONBOARDING_STEPS.done);
  });

  it("starts with the card", async () => {
    expect(await readStep()).toBe(ONBOARDING_STEPS.card);
  });

  it("resumes at the card until that step is finished", async () => {
    await post(postProfile, { company: "Tidewell" });

    expect(await readStep()).toBe(ONBOARDING_STEPS.card);
  });

  it("lets a member skip the card", async () => {
    await connectVillage();

    await post(postOnboarding, { step: ONBOARDING_STEPS.card });

    expect(await readStep()).toBe(ONBOARDING_STEPS.network);
  });

  describe("after the card", () => {
    beforeEach(async () => {
      await post(postOnboarding, { step: ONBOARDING_STEPS.card });
    });

    it("skips sharing and finishes when Village isn't connected", async () => {
      expect(await readStep()).toBe(ONBOARDING_STEPS.done);
    });

    it("skips sharing when the group doesn't exist yet", async () => {
      await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
      await database.insert(memberNetwork).values({ userId: member.userId, linkedinSlug: "amara-osei" });

      expect(await readStep()).toBe(ONBOARDING_STEPS.done);
    });

    it("asks about sharing when the group is ready", async () => {
      await connectVillage();

      expect(await readStep()).toBe(ONBOARDING_STEPS.network);
    });

    it("resumes at sharing on the next visit", async () => {
      await connectVillage();

      await readStep();

      expect(await readStep()).toBe(ONBOARDING_STEPS.network);
    });

    it("finishes when the member says not now, and never asks again in this flow", async () => {
      await connectVillage();

      await post(postOnboarding, { step: ONBOARDING_STEPS.network });

      expect(await readStep()).toBe(ONBOARDING_STEPS.done);
    });

    it("finishes once the member has consented", async () => {
      await connectVillage();
      await database
        .insert(memberNetwork)
        .values({ userId: member.userId, linkedinSlug: "amara-osei", sharingConsentedAt: new Date() });

      expect(await readStep()).toBe(ONBOARDING_STEPS.done);
    });

    it("stays finished if the member later leaves the group", async () => {
      await connectVillage();
      await database
        .insert(memberNetwork)
        .values({ userId: member.userId, linkedinSlug: "amara-osei", sharingConsentedAt: new Date() });
      await readStep();

      await database.update(memberNetwork).set({ sharingConsentedAt: null }).where(eq(memberNetwork.userId, member.userId));

      expect(await readStep()).toBe(ONBOARDING_STEPS.done);
    });

    it("records no consent when a member says not now", async () => {
      await connectVillage();

      await post(postOnboarding, { step: ONBOARDING_STEPS.network });
      const [network] = await database.select().from(memberNetwork).where(eq(memberNetwork.userId, member.userId));

      expect(network?.sharingConsentedAt ?? null).toBeNull();
    });
  });

  it("refuses a visitor", async () => {
    expect((await post(postOnboarding, { step: ONBOARDING_STEPS.card }, null)).status).toBe(UNAUTHORIZED_STATUS);
  });

  it("refuses an unknown step", async () => {
    expect((await post(postOnboarding, { step: "done" })).status).toBe(UNPROCESSABLE_STATUS);
  });
});
