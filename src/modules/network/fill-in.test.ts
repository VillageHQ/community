import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { memberFillIn, memberLookup, memberNetwork, memberProfile } from "@/modules/members/schema";
import { readMemberProfile } from "@/modules/members/service-profile";
import { readDirectory } from "@/modules/members/reads-directory";
import { FILL_IN_FIELDS } from "@/modules/members/contract-fill-in";
import { saveVillageKeys } from "@/platform/village/settings";
import { villageMonthlyUsage } from "@/platform/village/schema";
import { INSTANCE_SETTING_KEYS } from "@/platform/settings/schema";
import { saveSettings } from "@/platform/settings/store";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createFakeProfile, FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postFillInNow } from "@/app/api/network/fill-in/route";
import { POST as postFillInBasis } from "@/app/api/admin/village/fill-in/route";
import { POST as postLookupChoice } from "@/app/api/profile/lookup-choice/route";
import { POST as postVisibility } from "@/app/api/profile/fill-in/route";
import { POST as postProfile } from "@/app/api/profile/route";

import { runFillIn } from "./service-fill-in";

const APP_URL = "http://localhost:3000";
const BY_EMAIL_PATH = "/v2/people/enrich/by-email";
const BY_LINKEDIN_PATH = "/v2/people/enrich";
const DAY_MS = 24 * 60 * 60 * 1000;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function post(member: Member, body: unknown = {}) {
  return new Request(`${APP_URL}/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
    body: JSON.stringify(body),
  });
}

describe("profile fill-in", () => {
  const database = createTestDatabase();
  let village: Awaited<ReturnType<typeof startFakeVillageServer>>;
  let admin: Member;
  let member: Member;

  const lookupRequests = () => [...village.readRequests(BY_EMAIL_PATH), ...village.readRequests(BY_LINKEDIN_PATH)];

  async function recordTermsBasis() {
    const response = await postFillInBasis(post(admin, { basis: "terms", termsDate: "2026-01-15" }));
    expect(response.status).toBe(200);
  }

  async function makeLookupStale(memberId: string) {
    await database
      .update(memberLookup)
      .set({ lookedUpAt: new Date(Date.now() - 31 * DAY_MS) })
      .where(eq(memberLookup.userId, memberId));
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
    await database.delete(villageMonthlyUsage);
    village.reset();
    admin = await createSignedInMember(database, "admin");
    member = await createSignedInMember(database);
    await saveSettings(database, { [INSTANCE_SETTING_KEYS.firstAdminUserId]: admin.userId });
    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    village.state.profilesByEmail.set(member.email.toLowerCase(), createFakeProfile());
  });

  it("looks nobody up while no legal basis is recorded", async () => {
    const run = await runFillIn(database, process.env);
    const fillNow = await postFillInNow(post(member));

    expect(run.checked).toBe(0);
    expect(fillNow.status).toBe(409);
    expect(lookupRequests()).toEqual([]);
    expect(await database.select().from(memberFillIn)).toEqual([]);
  });

  it("refuses a member who isn't an admin from recording the basis", async () => {
    expect((await postFillInBasis(post(member, { basis: "terms", termsDate: "2026-01-15" }))).status).toBe(403);
  });

  it("fills a member in by email under the community's public identity once the basis is recorded", async () => {
    await recordTermsBasis();

    const run = await runFillIn(database, process.env);

    expect(run).toMatchObject({ checked: 2, found: 1, notFound: 1 });
    const [request] = village.readRequests(BY_EMAIL_PATH).filter(({ body }) => (body as { email: string }).email === member.email);
    expect(request?.body).toMatchObject({ email: member.email, mode: "cached_first" });
    expect(village.state.mintedGrants.get("community-profile-fill-in")).toBe("public");
    const profile = await readMemberProfile(database, member.userId);
    expect(profile?.shown).toMatchObject({
      title: "Head of Partnerships",
      company: "Example Co",
      location: "Lisbon, Portugal",
      imageUrl: "https://images.example.com/riley-example.jpg",
    });
    expect(profile?.shown.filledAt).toBeInstanceOf(Date);
    expect(profile?.title).toBeNull();
  });

  it("keeps a hidden line hidden after a refresh by LinkedIn", async () => {
    await recordTermsBasis();
    await runFillIn(database, process.env);
    expect((await postVisibility(post(member, { field: FILL_IN_FIELDS.company, isHidden: true }))).status).toBe(200);

    village.state.profilesByUrl.set("https://www.linkedin.com/in/riley-example", createFakeProfile({ company: "Example Holdings" }));
    await makeLookupStale(member.userId);
    await runFillIn(database, process.env);

    expect(village.readRequests(BY_LINKEDIN_PATH).map(({ body }) => body)).toContainEqual({ linkedin_url: "https://www.linkedin.com/in/riley-example" });
    const [company] = await database.select().from(memberFillIn).where(sql`${memberFillIn.userId} = ${member.userId} and ${memberFillIn.field} = 'company'`);
    expect(company).toMatchObject({ value: "Example Holdings" });
    expect(company?.hiddenAt).toBeInstanceOf(Date);
    const profile = await readMemberProfile(database, member.userId);
    expect(profile?.shown.company).toBeNull();
    expect(profile?.shown.title).toBe("Head of Partnerships");
  });

  it("shows the member's own words over filled-in ones, and their uploaded photo over the filled-in face", async () => {
    await recordTermsBasis();
    await runFillIn(database, process.env);

    expect((await postProfile(post(member, { title: "Founder", company: "" }))).status).toBe(200);
    await database.update(memberProfile).set({ location: "Porto" }).where(eq(memberProfile.userId, member.userId));

    const profile = await readMemberProfile(database, member.userId);
    expect(profile?.shown).toMatchObject({ title: "Founder", company: "Example Co", location: "Porto" });
    expect(profile?.shown.filledFields).toEqual([FILL_IN_FIELDS.company, FILL_IN_FIELDS.headline, FILL_IN_FIELDS.face]);
    const directory = await readDirectory(database, { search: "", tag: "", page: 1 });
    expect(directory.members.find(({ id }) => id === member.userId)).toMatchObject({ title: "Founder", company: "Example Co" });
  });

  it("never looks up a member who said don't look me up, and removes what was filled in", async () => {
    await recordTermsBasis();
    await runFillIn(database, process.env);
    expect(await database.select().from(memberFillIn).where(eq(memberFillIn.userId, member.userId))).not.toEqual([]);

    expect((await postLookupChoice(post(member, { allowsLookup: false }))).status).toBe(200);
    village.reset();
    await makeLookupStale(member.userId);
    await runFillIn(database, process.env);
    const fillNow = await postFillInNow(post(member));

    expect(fillNow.status).toBe(409);
    expect(village.readRequests(BY_EMAIL_PATH).filter(({ body }) => (body as { email: string }).email === member.email)).toEqual([]);
    expect(await database.select().from(memberFillIn).where(eq(memberFillIn.userId, member.userId))).toEqual([]);
  });

  it("with ask each member, looks up only the members who said yes", async () => {
    expect((await postFillInBasis(post(admin, { basis: "ask" }))).status).toBe(200);
    await runFillIn(database, process.env);
    expect(lookupRequests()).toEqual([]);

    await postLookupChoice(post(member, { allowsLookup: true }));
    const fillNow = await postFillInNow(post(member));

    expect(fillNow.status).toBe(200);
    expect(village.readRequests(BY_EMAIL_PATH)).toHaveLength(1);
    expect((await readMemberProfile(database, member.userId))?.shown.title).toBe("Head of Partnerships");
  });

  it("refuses a second Fill in now within the hour and counts the fill-in against the month, not the member's day", async () => {
    await recordTermsBasis();

    expect((await postFillInNow(post(member))).status).toBe(200);
    expect((await postFillInNow(post(member))).status).toBe(429);
    const [month] = await database.select().from(villageMonthlyUsage);
    expect(month).toMatchObject({ credits: 1, fillInCredits: 1 });
  });

  it("gives the credit back when nobody is found", async () => {
    await recordTermsBasis();
    village.state.profilesByEmail.clear();

    await runFillIn(database, process.env);

    const [month] = await database.select().from(villageMonthlyUsage);
    expect(month?.credits).toBe(0);
    const [lookup] = await database.select().from(memberLookup).where(eq(memberLookup.userId, member.userId));
    expect(lookup?.status).toBe("not_found");
  });

  it("refreshes by the member's own LinkedIn when they have one", async () => {
    await recordTermsBasis();
    await runFillIn(database, process.env);
    await database.insert(memberNetwork).values({ userId: member.userId, linkedinSlug: "riley-own" }).onConflictDoNothing();
    village.state.profilesByUrl.set("https://www.linkedin.com/in/riley-own", createFakeProfile({ slug: "riley-own" }));
    await makeLookupStale(member.userId);

    await runFillIn(database, process.env);

    expect(village.readRequests(BY_LINKEDIN_PATH).map(({ body }) => body)).toContainEqual({ linkedin_url: "https://www.linkedin.com/in/riley-own" });
  });
});
