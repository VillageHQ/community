import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { user } from "@/platform/database/auth-schema";
import { memberLookup, memberPrivacy, memberProfile } from "@/modules/members/schema";
import { resolveOnboardingStep } from "@/shell/onboarding";
import { WELCOME_ERRORS } from "@/shell/welcome-steps";
import { ONBOARDING_STEPS } from "@/modules/members/contract-profile";
import { saveFillInSettings } from "@/modules/members/service-fill-in";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postProfile } from "@/app/api/profile/route";
import { POST as postOnboarding } from "@/app/api/onboarding/route";
import { POST as postWelcome } from "@/app/api/onboarding/welcome/route";
import { POST as postPrivacy } from "@/app/api/onboarding/privacy/route";

const APP_URL = "http://localhost:3000";
const UNAUTHORIZED_STATUS = 401;
const UNPROCESSABLE_STATUS = 422;
const ABOUT = { name: "Nadia Cole", workingOn: "Payroll software for small clinics.", canHelpWith: "Founders hiring their first engineer.", role: "Founder", company: "Clinipay", city: "Lisbon" };

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

// Founderhall's two welcome steps: step 1 (the card), step 2 (privacy), then done. No network step.
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

  async function readMessage(response: Response) {
    return ((await response.json()) as { message?: string }).message;
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

  it("starts with step 1", async () => {
    expect(await readStep()).toBe(ONBOARDING_STEPS.card);
  });

  it("resumes at step 1 until it is saved", async () => {
    await post(postProfile, { company: "Tidewell" });

    expect(await readStep()).toBe(ONBOARDING_STEPS.card);
  });

  describe("step 1", () => {
    it("saves the name and the card's words, then moves to step 2", async () => {
      expect((await post(postWelcome, ABOUT)).status).toBe(200);

      const [profile] = await database.select().from(memberProfile).where(eq(memberProfile.userId, member.userId));
      expect(profile).toMatchObject({ bio: ABOUT.workingOn, canHelpWith: ABOUT.canHelpWith, title: "Founder", company: "Clinipay", location: "Lisbon" });
      const [saved] = await database.select({ name: user.name }).from(user).where(eq(user.id, member.userId));
      expect(saved?.name).toBe("Nadia Cole");
      expect(await readStep()).toBe(ONBOARDING_STEPS.introAsks);
    });

    it("asks for the name first, in Founderhall's words", async () => {
      const response = await post(postWelcome, { ...ABOUT, name: "  " });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect(await readMessage(response)).toBe(WELCOME_ERRORS.name);
      expect(await readStep()).toBe(ONBOARDING_STEPS.card);
    });

    it("asks for both questions", async () => {
      const response = await post(postWelcome, { ...ABOUT, canHelpWith: "" });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect(await readMessage(response)).toBe(WELCOME_ERRORS.questions);
    });

    it("leaves the details optional", async () => {
      expect((await post(postWelcome, { ...ABOUT, role: "", company: "", city: "" })).status).toBe(200);
    });
  });

  describe("step 2", () => {
    beforeEach(async () => {
      await post(postWelcome, ABOUT);
    });

    it("saves each choice and finishes, landing a member on the directory", async () => {
      const response = await post(postPrivacy, { isHidden: true, acceptsIntroAsks: false });

      expect(await response.json()).toEqual({ next: "/members" });
      const [privacy] = await database.select().from(memberPrivacy).where(eq(memberPrivacy.userId, member.userId));
      expect(privacy).toMatchObject({ isHidden: true, acceptsIntroAsks: false, introAsksAnsweredPlace: "onboarding" });
      expect(await readStep()).toBe(ONBOARDING_STEPS.done);
    });

    it("records the fill-in choice only while fill-in is on", async () => {
      await post(postPrivacy, { isHidden: false, acceptsIntroAsks: true, allowsLookup: false });
      expect(await database.select().from(memberLookup)).toEqual([]);
    });

    it("records a no to fill-in when it is on", async () => {
      await saveFillInSettings(database, { basis: "ask" });
      await post(postPrivacy, { isHidden: false, acceptsIntroAsks: true, allowsLookup: false });

      const [lookup] = await database.select().from(memberLookup).where(eq(memberLookup.userId, member.userId));
      expect(lookup?.refusedAt).toBeInstanceOf(Date);
    });

    it("stays finished on the next visit", async () => {
      await post(postPrivacy, { isHidden: false, acceptsIntroAsks: true });

      expect(await readStep()).toBe(ONBOARDING_STEPS.done);
      expect(await readStep()).toBe(ONBOARDING_STEPS.done);
    });
  });

  it("refuses a visitor", async () => {
    expect((await post(postWelcome, ABOUT, null)).status).toBe(UNAUTHORIZED_STATUS);
    expect((await post(postPrivacy, { isHidden: false }, null)).status).toBe(UNAUTHORIZED_STATUS);
  });

  it("refuses an unknown step", async () => {
    expect((await post(postOnboarding, { step: "done" })).status).toBe(UNPROCESSABLE_STATUS);
  });
});
