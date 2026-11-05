import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { user } from "@/platform/database/auth-schema";
import { introRequest } from "@/modules/intros/schema";
import { memberBlock, memberNetwork } from "@/modules/members/schema";
import { memberPathResult } from "@/modules/network/schema";
import {
  INTRO_ACTIONS,
  INTRO_ERROR_CODES,
  INTRO_LIFETIME_DAYS,
  INTRO_LIMITS,
  INTRO_ROLES,
  INTRO_STATES,
  introBoardSchema,
  introCountsSchema,
  introSchema,
  type Intro,
} from "@/modules/intros/contract";
import { ASKED_EMAIL_COOLDOWN_MS } from "@/modules/intros/email";
import { INTRO_MAXIMUM_PER_MINUTE } from "@/modules/intros/limits";
import { readIntroStateCounts } from "@/modules/intros/reads";
import { DAILY_LOOKUP_LIMITS } from "@/platform/village/contract";
import { NETWORK_ERROR_CODES, networkPathsSchema, networkSearchResultSchema } from "@/modules/network/contract";
import { saveVillageGroup } from "@/modules/network/service-settings";
import { saveVillageKeys } from "@/platform/village/settings";
import { EVENTUALLY } from "@/test/async-timeouts";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { joinMemberToGroup, makeIntroOverdue, nameMember } from "@/test/intros";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postClearLinkedin } from "@/app/api/admin/members/clear-linkedin/route";
import { POST as postConfirmLinkedin } from "@/app/api/admin/members/confirm-linkedin/route";
import { POST as postBlock } from "@/app/api/members/block/route";
import { POST as postLinkedin } from "@/app/api/network/linkedin/route";
import { POST as postPaths } from "@/app/api/network/paths/route";
import { POST as postSearch } from "@/app/api/network/search/route";
import { POST as postCounts } from "@/app/api/intros/counts/route";
import { POST as postCreate } from "@/app/api/intros/create/route";
import { POST as postDetail } from "@/app/api/intros/detail/route";
import { POST as postBoard } from "@/app/api/intros/route";
import { POST as postSeen } from "@/app/api/intros/seen/route";
import { POST as postTransition } from "@/app/api/intros/transition/route";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const FORBIDDEN_STATUS = 403;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const TOO_MANY_REQUESTS_STATUS = 429;
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const TARGET_SLUG = "clara-bergstrom";
const TARGET_URL = `https://www.linkedin.com/in/${TARGET_SLUG}`;
const JONAS_SLUG = "jonas-lindqvist";
const NOOR_SLUG = "noor-haddad";
const OUTSIDER_SLUG = "dele-adeyemi";
const AMARA_SLUG = "amara-osei";
const BYSTANDER_SLUG = "bystander";
const PATHS_PATH = "/v2/people/paths";
const SERVER_ERROR_STATUS = 500;
const CONCURRENT_ASKS = 6;
const EMAIL_SETTLE_MS = 100;
const EMAIL_CYCLES = 5;
const XSS_STRING = `<img src=x onerror=alert(1)><script>alert("x")</script>`;
const NOTE = "Hi Jonas, I'd love to meet Clara about freight pricing.";
const WORK_REASON = "Both worked at Corvane Logistics (1000 employees) 2017 - 2021. Jonas as CTO while Clara as VP";
const MILLISECONDS_PER_DAY = 86_400_000;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;

function call(handler: Handler, member: Member | null, body: unknown, origin = APP_URL) {
  return handler(
    new Request(`${APP_URL}/api/intros`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, ...(member ? { Cookie: member.cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
}

const JONAS = { first_name: "Jonas", last_name: "Lindqvist", linkedin_url: `https://www.linkedin.com/in/${JONAS_SLUG}`, headline: "CTO, Ledgerline" };
const NOOR = { first_name: "Noor", last_name: "Haddad", linkedin_url: `https://www.linkedin.com/in/${NOOR_SLUG}` };
const OUTSIDER = { first_name: "Dele", last_name: "Adeyemi", linkedin_url: `https://www.linkedin.com/in/${OUTSIDER_SLUG}` };
const AMARA = { first_name: "Amara", last_name: "Osei", linkedin_url: `https://www.linkedin.com/in/${AMARA_SLUG}` };

describe("intro requests", () => {
  const database = createTestDatabase();
  let village: Awaited<ReturnType<typeof startFakeVillageServer>>;
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let amara: Member;
  let jonas: Member;
  let noor: Member;
  let bystander: Member;
  let admin: Member;

  function setDefaultPaths() {
    village.state.pathsByUrl.set(TARGET_URL, {
      summary: "🟢 Jonas Lindqvist can intro (via Amara Osei)",
      target: { full_name: "Clara Bergström" },
      paths: [
        {
          degree: 2,
          description: "🟢 Dele Adeyemi can intro (via Amara Osei)",
          introducer: OUTSIDER,
          starter: AMARA,
          isStarterCurrentUser: true,
          introducerMeta: [{ title: "LinkedIn", description: "Both are connected on LinkedIn" }],
        },
        {
          degree: 2,
          description: "🟢 Jonas Lindqvist can intro (via Amara Osei)",
          introducer: JONAS,
          starter: AMARA,
          isStarterCurrentUser: true,
          introducerMeta: [
            { title: "LinkedIn", description: "Both are connected on LinkedIn" },
            { title: "Work", description: WORK_REASON },
          ],
        },
        {
          degree: 3,
          description: "🟡 Dele Adeyemi can intro (via Noor Haddad)",
          introducer: OUTSIDER,
          starter: NOOR,
          starterMeta: [{ title: "Verified interactions", description: "They met 12 times" }],
        },
      ],
    });
  }

  async function lookUpPaths(member: Member = amara, slug = TARGET_SLUG) {
    const response = await call(postPaths, member, { linkedinSlug: slug });
    expect(response.status).toBe(OK_STATUS);
    return networkPathsSchema.parse(await response.json());
  }

  function ask(member: Member = amara, overrides: Record<string, unknown> = {}) {
    return call(postCreate, member, { targetSlug: TARGET_SLUG, connectorSlug: JONAS_SLUG, note: NOTE, ...overrides });
  }

  async function createIntro(member: Member = amara, overrides: Record<string, unknown> = {}): Promise<Intro> {
    await lookUpPaths(member);
    const response = await ask(member, overrides);
    expect(response.status).toBe(OK_STATUS);
    return introSchema.parse(await response.json());
  }

  function transition(member: Member, introId: string, action: string, extra: Record<string, unknown> = {}) {
    return call(postTransition, member, { introId, action, ...extra });
  }

  async function readBoard(member: Member) {
    return introBoardSchema.parse(await (await call(postBoard, member, {})).json());
  }

  async function readCounts(member: Member) {
    return introCountsSchema.parse(await (await call(postCounts, member, {})).json());
  }

  async function readState(introId: string) {
    const [row] = await database.select({ state: introRequest.state }).from(introRequest).where(eq(introRequest.id, introId));
    return row?.state;
  }

  function configureResend() {
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.com>");
    vi.stubEnv("RESEND_API_URL", resend.url);
  }

  beforeAll(async () => {
    village = await startFakeVillageServer();
    resend = await startFakeResendServer();
    process.env.VILLAGE_API_URL = village.url;
    process.env.VILLAGE_SDK_URL = "https://sdk.village.test";
  });

  afterAll(async () => {
    delete process.env.VILLAGE_API_URL;
    delete process.env.VILLAGE_SDK_URL;
    await village.stop();
    await resend.stop();
    await database.$client.end();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    village.reset();
    resend.reset();
    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    await saveVillageGroup(database, { id: "group-1", inviteLink: "https://village.test/join/invite-code" });
    amara = await createSignedInMember(database);
    jonas = await createSignedInMember(database);
    noor = await createSignedInMember(database);
    bystander = await createSignedInMember(database);
    admin = await createSignedInMember(database, "admin");
    const memberSlugs: [Member, string][] = [
      [amara, AMARA_SLUG],
      [jonas, JONAS_SLUG],
      [noor, NOOR_SLUG],
      [bystander, BYSTANDER_SLUG],
    ];
    for (const [member, slug] of memberSlugs) {
      const externalId = await joinMemberToGroup(database, member.userId, slug);
      village.state.linkedMembers.set(externalId, { isSynced: true, email: member.email });
    }
    await nameMember(database, amara.userId, "Amara Osei");
    await nameMember(database, jonas.userId, "Jonas Lindqvist");
    await nameMember(database, noor.userId, "Noor Haddad");
    setDefaultPaths();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("the paths a member sees", () => {
    it("shows an ask the member already made, so they can't ask twice", async () => {
      const intro = await createIntro();

      const { connectors } = await lookUpPaths();
      const jonas = connectors.find(({ linkedinSlug }) => linkedinSlug === JONAS_SLUG);

      expect(jonas?.openAsk).toEqual({ id: intro.id, state: INTRO_STATES.requested });
    });

    it("ranks community members first and explains each one with Village's reason", async () => {
      const { connectors } = await lookUpPaths();

      expect(connectors.map(({ name, member }) => [name, member !== null])).toEqual([
        ["Jonas Lindqvist", true],
        ["Noor Haddad", true],
        ["Dele Adeyemi", false],
      ]);
      expect(connectors[0]?.reason).toBe(
        "Both worked at Corvane Logistics 2017 - 2021. Jonas as CTO while Clara as VP. Both are connected on LinkedIn.",
      );
    });

    it("labels an introducer outside the community and offers no member link", async () => {
      const { connectors } = await lookUpPaths();
      const outsider = connectors.find(({ name }) => name === "Dele Adeyemi");

      expect(outsider?.member).toBeNull();
      expect(outsider?.linkedinSlug).toBe(OUTSIDER_SLUG);
    });

    it("says who a starter connector reaches the target through", async () => {
      const { connectors } = await lookUpPaths();
      const starterConnector = connectors.find(({ name }) => name === "Noor Haddad");

      expect(starterConnector?.throughName).toBe("Dele Adeyemi");
      expect(starterConnector?.reason).toContain("Noor knows Dele Adeyemi, who can reach Clara.");
      expect(starterConnector?.reason).toContain("They met 12 times.");
    });

    it("never offers the viewer or the target as a connector", async () => {
      village.state.pathsByUrl.set(TARGET_URL, {
        summary: "s",
        target: { full_name: "Clara Bergström" },
        paths: [
          { degree: 2, description: "d", introducer: AMARA },
          { degree: 2, description: "d", introducer: { first_name: "Clara", last_name: "B", linkedin_url: TARGET_URL } },
        ],
      });

      expect((await lookUpPaths()).connectors).toEqual([]);
    });

    it("treats a banned member as unreachable", async () => {
      await database.update(user).set({ banned: true }).where(eq(user.id, jonas.userId));

      const { connectors } = await lookUpPaths();

      expect(connectors.find(({ name }) => name === "Jonas Lindqvist")?.member).toBeNull();
    });

    it("marks a real direct connection without inventing a connector", async () => {
      village.state.pathsByUrl.set(TARGET_URL, {
        summary: "🟢 Direct connection",
        target: { full_name: "Clara Bergström" },
        paths: [{ degree: 1, description: "🟢 Direct connection", introducer: AMARA, starter: AMARA, isStarterCurrentUser: true }],
      });

      const paths = await lookUpPaths();

      expect(paths.isDirectConnection).toBe(true);
      expect(paths.connectors).toEqual([]);
    });

    it("relabels a fellow member and links to them", async () => {
      const jonasUrl = `https://www.linkedin.com/in/${JONAS_SLUG}`;
      village.state.pathsByUrl.set(jonasUrl, {
        summary: "🟢 Direct connection",
        target: { full_name: "Jonas Lindqvist" },
        paths: [{ degree: 1, description: "🟢 Direct connection", introducer: JONAS }],
      });

      const paths = await lookUpPaths(amara, JONAS_SLUG);

      expect(paths.isDirectConnection).toBe(false);
      expect(paths.targetMemberId).toBe(jonas.userId);
      expect(paths.summary).toBe("Community member");
    });

    it("looks up again, once, when a cached row predates target names", async () => {
      const stalePaths = { summary: null, paths: [] };
      await database.insert(memberPathResult).values({ userId: amara.userId, linkedinSlug: TARGET_SLUG, paths: stalePaths, fetchedAt: new Date() });

      await lookUpPaths();
      await lookUpPaths();

      expect(village.readRequests(PATHS_PATH)).toHaveLength(1);
    });

    it("keeps caching lookups per member", async () => {
      await lookUpPaths();
      await lookUpPaths();
      await lookUpPaths(noor);

      expect(village.readRequests(PATHS_PATH)).toHaveLength(2);
    });

    it("reports how many lookups are left today", async () => {
      expect((await lookUpPaths()).dailyLookupsLeft).toBe(DAILY_LOOKUP_LIMITS.default - 1);
    });
  });

  describe("a member claiming someone else's LinkedIn", () => {
    async function makeImpostor() {
      await nameMember(database, bystander.userId, "Mallory Fake");
      await database.update(memberNetwork).set({ linkedinSlug: "stolen-slot" }).where(eq(memberNetwork.userId, jonas.userId));
      await database.update(memberNetwork).set({ linkedinSlug: JONAS_SLUG }).where(eq(memberNetwork.userId, bystander.userId));
    }

    async function readJonasConnector() {
      return (await lookUpPaths()).connectors.find(({ linkedinSlug }) => linkedinSlug === JONAS_SLUG);
    }

    it("shows the real person as outside the community", async () => {
      await makeImpostor();

      const connector = await readJonasConnector();

      expect(connector?.name).toBe("Jonas Lindqvist");
      expect(connector?.member).toBeNull();
    });

    it("refuses an ask that would reach the impostor", async () => {
      await makeImpostor();
      await lookUpPaths();

      expect(await (await ask()).json()).toMatchObject({ code: INTRO_ERROR_CODES.notConnector });
      expect(await database.select().from(introRequest)).toEqual([]);
    });

    it("doesn't offer the impostor when the claimed person is the target", async () => {
      await makeImpostor();
      village.state.pathsByUrl.set(`https://www.linkedin.com/in/${JONAS_SLUG}`, {
        summary: "s",
        target: { full_name: "Jonas Lindqvist" },
        paths: [],
      });

      expect((await lookUpPaths(amara, JONAS_SLUG)).targetMemberId).toBeNull();
    });

    it("doesn't badge the impostor in search", async () => {
      await makeImpostor();
      village.state.searchPeople = [{ full_name: "Jonas Lindqvist", linkedin_url: `https://www.linkedin.com/in/${JONAS_SLUG}` }];

      const result = networkSearchResultSchema.parse(await (await call(postSearch, amara, { prompt: "cto" })).json());

      expect(result.people[0]).toMatchObject({ isMember: false, memberId: null });
    });

    it("shows a matched member under their own name and profile", async () => {
      await nameMember(database, jonas.userId, "JONÁS Erik Lindqvist");

      const connector = await readJonasConnector();

      expect(connector?.name).toBe("JONÁS Erik Lindqvist");
      expect(connector?.member?.id).toBe(jonas.userId);
    });

    it("still matches someone who shares the name, which only an admin can clear", async () => {
      await nameMember(database, bystander.userId, "Jonas Lindqvist");
      await database.update(memberNetwork).set({ linkedinSlug: "stolen-slot" }).where(eq(memberNetwork.userId, jonas.userId));
      await database.update(memberNetwork).set({ linkedinSlug: JONAS_SLUG }).where(eq(memberNetwork.userId, bystander.userId));

      expect((await readJonasConnector())?.member?.id).toBe(bystander.userId);
    });

    describe("Confirm this LinkedIn", () => {
      beforeEach(async () => {
        await nameMember(database, jonas.userId, "JJ");
      });

      function confirmJonas(member: Member = admin) {
        return call(postConfirmLinkedin, member, { memberId: jonas.userId });
      }

      it("leaves a legitimate name difference outside until an admin confirms", async () => {
        expect((await readJonasConnector())?.member).toBeNull();

        expect((await confirmJonas()).status).toBe(OK_STATUS);

        const connector = await readJonasConnector();
        expect(connector?.member?.id).toBe(jonas.userId);
        expect(connector?.name).toBe("JJ");
      });

      it("is admin-only", async () => {
        expect((await confirmJonas(amara)).status).toBe(FORBIDDEN_STATUS);
        expect((await readJonasConnector())?.member).toBeNull();
      });

      it("lapses when the member changes their LinkedIn", async () => {
        await confirmJonas();
        await call(postLinkedin, jonas, { linkedinUrl: "https://www.linkedin.com/in/another-profile" });
        await call(postLinkedin, jonas, { linkedinUrl: `https://www.linkedin.com/in/${JONAS_SLUG}` });
        await database.update(memberNetwork).set({ linkedinSlug: "another-profile" }).where(eq(memberNetwork.userId, jonas.userId));

        expect((await readJonasConnector())?.member).toBeNull();
      });

      it("lapses when an admin clears the claim", async () => {
        await confirmJonas();
        await call(postClearLinkedin, admin, { linkedinUrl: `https://www.linkedin.com/in/${JONAS_SLUG}` });
        await database.update(memberNetwork).set({ linkedinSlug: JONAS_SLUG }).where(eq(memberNetwork.userId, jonas.userId));

        expect((await readJonasConnector())?.member).toBeNull();
      });

      it("refuses a member with no LinkedIn", async () => {
        await database.update(memberNetwork).set({ linkedinSlug: null }).where(eq(memberNetwork.userId, jonas.userId));

        expect((await confirmJonas()).status).toBe(NOT_FOUND_STATUS);
      });
    });
  });

  describe("search badges", () => {
    it("treats a banned member as outside", async () => {
      await database.update(user).set({ banned: true }).where(eq(user.id, jonas.userId));
      village.state.searchPeople = [{ full_name: "Jonas Lindqvist", linkedin_url: `https://www.linkedin.com/in/${JONAS_SLUG}` }];

      const result = networkSearchResultSchema.parse(await (await call(postSearch, amara, { prompt: "cto" })).json());

      expect(result.people[0]).toMatchObject({ isMember: false, memberId: null });
    });
  });

  describe("asking for an intro", () => {
    it("rejects requests without a session or from another site", async () => {
      const anonymous = await call(postCreate, null, { targetSlug: TARGET_SLUG, connectorSlug: JONAS_SLUG, note: NOTE });
      const foreign = await call(postCreate, amara, { targetSlug: TARGET_SLUG, connectorSlug: JONAS_SLUG, note: NOTE }, "https://evil.test");

      expect(anonymous.status).toBe(UNAUTHORIZED_STATUS);
      expect(foreign.status).toBe(FORBIDDEN_STATUS);
    });

    it("snapshots the target and connector from the cached result", async () => {
      const intro = await createIntro();

      expect(intro).toMatchObject({
        state: INTRO_STATES.requested,
        viewerRole: INTRO_ROLES.requester,
        note: NOTE,
        target: { name: "Clara Bergström", linkedinSlug: TARGET_SLUG, headline: null },
        introducer: { id: jonas.userId, name: "Jonas Lindqvist", headline: "CTO, Ledgerline", linkedinSlug: JONAS_SLUG },
      });
      expect(intro.reason).toContain("Both worked at Corvane Logistics");
    });

    it("ignores target and connector details the client makes up", async () => {
      const intro = await createIntro(amara, {
        targetName: "Forged Target",
        target: { name: "Forged Target" },
        introducerId: bystander.userId,
        introducerName: "Forged Connector",
        reason: "Forged reason",
      });

      expect(intro.target.name).toBe("Clara Bergström");
      expect(intro.introducer.id).toBe(jonas.userId);
      expect(intro.reason).not.toContain("Forged");
    });

    it("expires exactly the named number of days from now", async () => {
      const intro = await createIntro();
      const lifetimeMs = new Date(intro.expiresAt).getTime() - new Date(intro.createdAt).getTime();

      expect(Math.round(lifetimeMs / MILLISECONDS_PER_DAY)).toBe(INTRO_LIFETIME_DAYS);
    });

    it("refuses asking for an intro to yourself", async () => {
      const ownUrl = `https://www.linkedin.com/in/${AMARA_SLUG}`;
      village.state.pathsByUrl.set(ownUrl, {
        summary: "s",
        target: { full_name: "Amara Osei" },
        paths: [{ degree: 2, description: "d", introducer: JONAS }],
      });
      const paths = await lookUpPaths(amara, AMARA_SLUG);

      const response = await ask(amara, { targetSlug: AMARA_SLUG });

      expect(paths.isViewer).toBe(true);
      expect(paths.connectors).toEqual([]);
      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect(await response.json()).toMatchObject({ code: INTRO_ERROR_CODES.ownTarget });
    });

    it("refuses asking for an intro to yourself without any lookup", async () => {
      const response = await ask(amara, { targetSlug: AMARA_SLUG });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect(await response.json()).toMatchObject({ code: INTRO_ERROR_CODES.ownTarget });
    });

    describe("refusing forged asks", () => {
      it("refuses a target the member never looked up", async () => {
        const response = await ask(amara, { targetSlug: "someone-else" });

        expect(response.status).toBe(CONFLICT_STATUS);
        expect(await response.json()).toMatchObject({ code: INTRO_ERROR_CODES.pathsStale });
      });

      it("refuses a cached result older than its lifetime", async () => {
        await lookUpPaths();
        await database.update(memberPathResult).set({ fetchedAt: new Date("2020-01-01T00:00:00.000Z") });

        expect(await (await ask()).json()).toMatchObject({ code: INTRO_ERROR_CODES.pathsStale });
      });

      it.each([
        ["a member who isn't on the path", BYSTANDER_SLUG],
        ["someone outside the community", OUTSIDER_SLUG],
        ["the requester", AMARA_SLUG],
        ["the target", TARGET_SLUG],
      ])("refuses %s as the connector", async (_label, connectorSlug) => {
        await lookUpPaths();

        const response = await ask(amara, { connectorSlug });

        expect(response.status).toBe(CONFLICT_STATUS);
        expect(await response.json()).toMatchObject({ code: INTRO_ERROR_CODES.notConnector });
      });

      it("reads another member's cached result for nobody", async () => {
        await lookUpPaths(noor);

        expect(await (await ask(amara)).json()).toMatchObject({ code: INTRO_ERROR_CODES.pathsStale });
      });
    });

    describe("checking the connector", () => {
      it.each([
        ["banned", { banned: true }],
        ["unverified", { emailVerified: false }],
      ])("refuses a %s connector", async (_label, change) => {
        await lookUpPaths();
        await database.update(user).set(change).where(eq(user.id, jonas.userId));

        expect(await (await ask()).json()).toMatchObject({ code: INTRO_ERROR_CODES.notConnector });
      });

      it("refuses a connector who left the group", async () => {
        await lookUpPaths();
        await database.update(memberNetwork).set({ groupJoinedAt: null }).where(eq(memberNetwork.userId, jonas.userId));

        expect(await (await ask()).json()).toMatchObject({ code: INTRO_ERROR_CODES.notConnector });
      });
    });

    describe("checking the requester", () => {
      it("refuses a requester who hasn't confirmed their email", async () => {
        await lookUpPaths();
        await database.update(user).set({ emailVerified: false }).where(eq(user.id, amara.userId));

        expect(await (await ask()).json()).toMatchObject({ code: NETWORK_ERROR_CODES.emailNotConfirmed });
      });

      it("refuses a requester who hasn't joined", async () => {
        await lookUpPaths();
        await database.update(memberNetwork).set({ groupJoinedAt: null }).where(eq(memberNetwork.userId, amara.userId));

        expect(await (await ask()).json()).toMatchObject({ code: NETWORK_ERROR_CODES.notReady });
      });

      it("refuses a requester whose Village link needs approval", async () => {
        await lookUpPaths();
        await database.update(memberNetwork).set({ pendingVillageEmail: "other@example.com" }).where(eq(memberNetwork.userId, amara.userId));

        expect(await (await ask()).json()).toMatchObject({ code: NETWORK_ERROR_CODES.linkMismatch });
      });
    });

    describe("refusing duplicates", () => {
      it("refuses a second open ask for the same target and introducer", async () => {
        await createIntro();

        const response = await ask();

        expect(response.status).toBe(CONFLICT_STATUS);
        expect(await response.json()).toMatchObject({ code: INTRO_ERROR_CODES.duplicate });
      });

      it("lets exactly one of many concurrent asks through", async () => {
        await lookUpPaths();

        const responses = await Promise.all(Array.from({ length: CONCURRENT_ASKS }, () => ask()));

        expect(responses.filter(({ status }) => status === OK_STATUS)).toHaveLength(1);
        expect(await database.select().from(introRequest)).toHaveLength(1);
      });

      it("still allows the same target through a different connector", async () => {
        await createIntro();

        expect((await ask(amara, { connectorSlug: NOOR_SLUG })).status).toBe(OK_STATUS);
      });

      it("allows a new ask once the first is withdrawn", async () => {
        const intro = await createIntro();
        await transition(amara, intro.id, INTRO_ACTIONS.withdraw);

        expect((await ask()).status).toBe(OK_STATUS);
      });

      it("allows a new ask once the first has expired", async () => {
        const intro = await createIntro();
        await makeIntroOverdue(database, intro.id);

        expect((await ask()).status).toBe(OK_STATUS);
      });
    });

    describe("capping text", () => {
      beforeEach(async () => {
        await lookUpPaths();
      });

      it("refuses an empty note", async () => {
        expect((await ask(amara, { note: "   " })).status).toBe(UNPROCESSABLE_STATUS);
      });

      it("refuses a note over the limit", async () => {
        expect((await ask(amara, { note: "a".repeat(INTRO_LIMITS.noteLength + 1) })).status).toBe(UNPROCESSABLE_STATUS);
      });

      it("strips bidirectional controls from the note", async () => {
        const intro = introSchema.parse(await (await ask(amara, { note: "hello\u202Edlrow" })).json());

        expect(intro.note).toBe("hellodlrow");
      });

      it("keeps markup as plain text", async () => {
        const intro = introSchema.parse(await (await ask(amara, { note: XSS_STRING })).json());

        expect(intro.note).toBe(XSS_STRING);
      });
    });

    it("limits how fast a member can ask", async () => {
      const targets = Array.from({ length: INTRO_MAXIMUM_PER_MINUTE.ask + 1 }, (_unused, position) => `target-${position}`);
      for (const slug of targets) {
        village.state.pathsByUrl.set(`https://www.linkedin.com/in/${slug}`, {
          summary: "s",
          target: { full_name: "Someone Else" },
          paths: [{ degree: 2, description: "d", introducer: JONAS }],
        });
        await lookUpPaths(amara, slug);
      }

      const statuses = [];
      for (const targetSlug of targets) statuses.push((await ask(amara, { targetSlug })).status);

      expect(statuses.at(-1)).toBe(TOO_MANY_REQUESTS_STATUS);
    });

    describe("a blocked requester", () => {
      async function blockAmara() {
        await database.insert(memberBlock).values({ blockerId: jonas.userId, blockedId: amara.userId });
      }

      it("gets the same answer as anyone else", async () => {
        const delivered = await createIntro(noor);
        await blockAmara();

        const withheld = await createIntro(amara);

        expect(Object.keys(withheld).toSorted()).toEqual(Object.keys(delivered).toSorted());
        expect(withheld.state).toBe(INTRO_STATES.requested);
        expect(JSON.stringify(withheld)).not.toMatch(/withheld|blocked/i);
      });

      it("sees their ask in their own list, like any other", async () => {
        await blockAmara();
        const intro = await createIntro();

        expect((await readBoard(amara)).yourAsks.map(({ id }) => id)).toEqual([intro.id]);
      });

      it("delivers nothing to the blocker", async () => {
        configureResend();
        await blockAmara();
        const intro = await createIntro();

        expect((await readBoard(jonas)).asksForYou).toEqual([]);
        expect((await readCounts(jonas)).waitingOnYou).toBe(0);
        expect((await call(postDetail, jonas, { introId: intro.id })).status).toBe(NOT_FOUND_STATUS);
        expect((await transition(jonas, intro.id, INTRO_ACTIONS.accept)).status).toBe(NOT_FOUND_STATUS);
        await new Promise((resolve) => setTimeout(resolve, EMAIL_SETTLE_MS));
        expect(resend.state.emails).toEqual([]);
      });

      it("stays hidden from the blocker after an unblock, like messages", async () => {
        await blockAmara();
        await createIntro();
        await database.delete(memberBlock);

        expect((await readBoard(jonas)).asksForYou).toEqual([]);
      });

      it("keeps a member's own view of an ask they withdrew", async () => {
        await blockAmara();
        const intro = await createIntro();

        const withdrawn = introSchema.parse(await (await transition(amara, intro.id, INTRO_ACTIONS.withdraw)).json());

        expect(withdrawn.state).toBe(INTRO_STATES.withdrawn);
      });

      it("refuses a duplicate the same way", async () => {
        await blockAmara();
        await createIntro();

        expect(await (await ask()).json()).toMatchObject({ code: INTRO_ERROR_CODES.duplicate });
      });

      it("tells a member who blocked the connector themselves, because that hides nothing", async () => {
        await lookUpPaths();
        await database.insert(memberBlock).values({ blockerId: amara.userId, blockedId: jonas.userId });

        expect(await (await ask()).json()).toMatchObject({ code: INTRO_ERROR_CODES.blockedByYou });
      });
    });
  });

  describe("moving an ask between states", () => {
    let intro: Intro;

    beforeEach(async () => {
      intro = await createIntro();
    });

    it("walks from requested to accepted to completed", async () => {
      const accepted = introSchema.parse(await (await transition(jonas, intro.id, INTRO_ACTIONS.accept)).json());
      const completed = introSchema.parse(await (await transition(jonas, intro.id, INTRO_ACTIONS.complete)).json());

      expect(accepted.state).toBe(INTRO_STATES.accepted);
      expect(accepted.acceptedAt).not.toBeNull();
      expect(completed.state).toBe(INTRO_STATES.completed);
      expect(completed.closedAt).not.toBeNull();
    });

    it("gives the introducer a fresh clock after accepting", async () => {
      await makeIntroOverdueSoon(intro.id);

      const accepted = introSchema.parse(await (await transition(jonas, intro.id, INTRO_ACTIONS.accept)).json());

      expect(new Date(accepted.expiresAt).getTime()).toBeGreaterThan(Date.now() + (INTRO_LIFETIME_DAYS - 1) * MILLISECONDS_PER_DAY);
    });

    describe("a decline reason", () => {
      const REASON = "I barely know them";

      beforeEach(async () => {
        await transition(jonas, intro.id, INTRO_ACTIONS.decline, { reason: REASON });
      });

      it("stays with the introducer", async () => {
        const asIntroducer = introSchema.parse(await (await call(postDetail, jonas, { introId: intro.id })).json());

        expect(asIntroducer.declineReason).toBe(REASON);
      });

      it("never reaches the requester through any response", async () => {
        const detail = await (await call(postDetail, amara, { introId: intro.id })).text();
        const board = await (await call(postBoard, amara, {})).text();

        expect(detail).not.toContain(REASON);
        expect(board).not.toContain(REASON);
        expect(introSchema.parse(JSON.parse(detail)).state).toBe(INTRO_STATES.declined);
      });

      it("isn't readable by a bystander", async () => {
        expect((await call(postDetail, bystander, { introId: intro.id })).status).toBe(NOT_FOUND_STATUS);
      });
    });

    it("declines without any reason", async () => {
      const declined = introSchema.parse(await (await transition(jonas, intro.id, INTRO_ACTIONS.decline)).json());

      expect(declined.declineReason).toBeNull();
    });

    it("treats a blank reason as no reason", async () => {
      const declined = introSchema.parse(await (await transition(jonas, intro.id, INTRO_ACTIONS.decline, { reason: "   " })).json());

      expect(declined.declineReason).toBeNull();
    });

    it("refuses a reason over the limit", async () => {
      const response = await transition(jonas, intro.id, INTRO_ACTIONS.decline, { reason: "a".repeat(INTRO_LIMITS.declineReasonLength + 1) });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
    });

    it("lets the requester withdraw while requested", async () => {
      const withdrawn = introSchema.parse(await (await transition(amara, intro.id, INTRO_ACTIONS.withdraw)).json());

      expect(withdrawn.state).toBe(INTRO_STATES.withdrawn);
    });

    describe("refusing illegal moves", () => {
      it("refuses to complete an ask nobody accepted", async () => {
        const response = await transition(jonas, intro.id, INTRO_ACTIONS.complete);

        expect(response.status).toBe(CONFLICT_STATUS);
        expect(await response.json()).toMatchObject({ code: INTRO_ERROR_CODES.changed });
        expect(await readState(intro.id)).toBe(INTRO_STATES.requested);
      });

      it("refuses to withdraw after an accept", async () => {
        await transition(jonas, intro.id, INTRO_ACTIONS.accept);

        expect((await transition(amara, intro.id, INTRO_ACTIONS.withdraw)).status).toBe(CONFLICT_STATUS);
        expect(await readState(intro.id)).toBe(INTRO_STATES.accepted);
      });

      it("refuses to accept after a withdraw", async () => {
        await transition(amara, intro.id, INTRO_ACTIONS.withdraw);

        expect((await transition(jonas, intro.id, INTRO_ACTIONS.accept)).status).toBe(CONFLICT_STATUS);
      });

      it("refuses to reopen a declined ask", async () => {
        await transition(jonas, intro.id, INTRO_ACTIONS.decline);

        expect((await transition(jonas, intro.id, INTRO_ACTIONS.accept)).status).toBe(CONFLICT_STATUS);
      });

      it("refuses a requester accepting their own ask", async () => {
        expect((await transition(amara, intro.id, INTRO_ACTIONS.accept)).status).toBe(NOT_FOUND_STATUS);
      });

      it("refuses an introducer withdrawing someone else's ask", async () => {
        expect((await transition(jonas, intro.id, INTRO_ACTIONS.withdraw)).status).toBe(NOT_FOUND_STATUS);
      });

      it("refuses an unknown action", async () => {
        expect((await transition(jonas, intro.id, "reopen")).status).toBe(UNPROCESSABLE_STATUS);
      });
    });

    describe("under concurrency", () => {
      it("applies exactly one of a simultaneous accept and withdraw", async () => {
        const [accept, withdraw] = await Promise.all([
          transition(jonas, intro.id, INTRO_ACTIONS.accept),
          transition(amara, intro.id, INTRO_ACTIONS.withdraw),
        ]);

        const statuses = [accept.status, withdraw.status].toSorted();
        const state = await readState(intro.id);

        expect(statuses).toEqual([OK_STATUS, CONFLICT_STATUS]);
        expect(state).toBe(accept.status === OK_STATUS ? INTRO_STATES.accepted : INTRO_STATES.withdrawn);
      });

      it("applies exactly one of a simultaneous accept and decline", async () => {
        await Promise.all([transition(jonas, intro.id, INTRO_ACTIONS.accept), transition(jonas, intro.id, INTRO_ACTIONS.decline)]);

        const [row] = await database.select().from(introRequest).where(eq(introRequest.id, intro.id));

        expect(row?.state === INTRO_STATES.accepted ? row.closedAt : row?.acceptedAt).toBeNull();
      });

      it("sends one email when accept is double-clicked", async () => {
        configureResend();

        const responses = await Promise.all(Array.from({ length: CONCURRENT_ASKS }, () => transition(jonas, intro.id, INTRO_ACTIONS.accept)));

        expect(responses.every(({ status }) => status === OK_STATUS)).toBe(true);
        await vi.waitFor(() => expect(resend.state.emails).toHaveLength(1), EVENTUALLY);
      });
    });

    describe("expiring lazily at read time", () => {
      beforeEach(async () => {
        await makeIntroOverdue(database, intro.id);
      });

      it("expires when either participant next reads", async () => {
        const { yourAsks } = await readBoard(amara);

        expect(yourAsks[0]?.state).toBe(INTRO_STATES.expired);
        expect(await readState(intro.id)).toBe(INTRO_STATES.expired);
      });

      it("expires when the introducer checks their badge", async () => {
        expect((await readCounts(jonas)).waitingOnYou).toBe(0);
        expect(await readState(intro.id)).toBe(INTRO_STATES.expired);
      });

      it("refuses to accept an overdue ask", async () => {
        expect((await transition(jonas, intro.id, INTRO_ACTIONS.accept)).status).toBe(CONFLICT_STATUS);
        expect(await readState(intro.id)).toBe(INTRO_STATES.expired);
      });

      it("refuses to withdraw an overdue ask", async () => {
        expect((await transition(amara, intro.id, INTRO_ACTIONS.withdraw)).status).toBe(CONFLICT_STATUS);
      });

      it("tells the requester through the badge", async () => {
        expect((await readCounts(amara)).updates).toBe(1);
      });
    });

    it("expires an accepted ask that's never marked as introduced", async () => {
      await transition(jonas, intro.id, INTRO_ACTIONS.accept);
      await makeIntroOverdue(database, intro.id);

      const [expired] = (await readBoard(amara)).yourAsks;

      expect(expired?.state).toBe(INTRO_STATES.expired);
      expect(expired?.acceptedAt).not.toBeNull();
    });
  });

  describe("a block placed after the ask", () => {
    let intro: Intro;

    function block(blocker: Member, blocked: Member, isBlocked = true) {
      return call(postBlock, blocker, { memberId: blocked.userId, isBlocked });
    }

    beforeEach(async () => {
      intro = await createIntro();
    });

    describe("by the introducer", () => {
      it("takes the ask off their list and badge", async () => {
        await block(jonas, amara);

        expect((await readBoard(jonas)).asksForYou).toEqual([]);
        expect((await readCounts(jonas)).waitingOnYou).toBe(0);
      });

      it("stops them answering it", async () => {
        await block(jonas, amara);

        expect((await call(postDetail, jonas, { introId: intro.id })).status).toBe(NOT_FOUND_STATUS);
        expect((await transition(jonas, intro.id, INTRO_ACTIONS.accept)).status).toBe(NOT_FOUND_STATUS);
        expect(await readState(intro.id)).toBe(INTRO_STATES.requested);
      });

      it("changes nothing the requester can see", async () => {
        const before = await (await call(postDetail, amara, { introId: intro.id })).text();

        await block(jonas, amara);

        expect(await (await call(postDetail, amara, { introId: intro.id })).text()).toBe(before);
      });

      it("stops an accepted ask too, and the requester still sees the yes", async () => {
        await transition(jonas, intro.id, INTRO_ACTIONS.accept);
        await block(jonas, amara);

        expect((await transition(jonas, intro.id, INTRO_ACTIONS.complete)).status).toBe(NOT_FOUND_STATUS);
        expect((await readBoard(amara)).yourAsks[0]?.state).toBe(INTRO_STATES.accepted);
      });

      it("stays hidden after an unblock, like messages", async () => {
        await block(jonas, amara);
        await block(jonas, amara, false);

        expect((await readBoard(jonas)).asksForYou).toEqual([]);
      });

      it("leaves asks from other members alone", async () => {
        const fromNoor = await createIntro(noor);
        await block(jonas, amara);

        expect((await readBoard(jonas)).asksForYou.map(({ id }) => id)).toEqual([fromNoor.id]);
      });
    });

    describe("by the requester", () => {
      it("closes the unanswered ask as a plain withdrawal", async () => {
        await block(amara, jonas);

        const asIntroducer = introSchema.parse(await (await call(postDetail, jonas, { introId: intro.id })).json());

        expect(asIntroducer.state).toBe(INTRO_STATES.withdrawn);
        expect(JSON.stringify(asIntroducer)).not.toMatch(/block/i);
        expect((await transition(jonas, intro.id, INTRO_ACTIONS.accept)).status).toBe(CONFLICT_STATUS);
      });

      it("stops an accepted ask reaching the blocked introducer", async () => {
        await transition(jonas, intro.id, INTRO_ACTIONS.accept);

        await block(amara, jonas);

        expect((await readBoard(jonas)).asksForYou).toEqual([]);
        expect((await transition(jonas, intro.id, INTRO_ACTIONS.complete)).status).toBe(NOT_FOUND_STATUS);
      });
    });
  });

  describe("when a participant leaves the group", () => {
    let intro: Intro;

    function leave(member: Member) {
      return database.update(memberNetwork).set({ groupJoinedAt: null }).where(eq(memberNetwork.userId, member.userId));
    }

    beforeEach(async () => {
      intro = await createIntro();
    });

    it("closes the ask when the introducer left", async () => {
      await leave(jonas);

      expect((await readBoard(amara)).yourAsks[0]?.state).toBe(INTRO_STATES.expired);
    });

    it("closes the ask when the requester left", async () => {
      await leave(amara);

      expect((await readBoard(jonas)).asksForYou[0]?.state).toBe(INTRO_STATES.expired);
      expect((await readCounts(jonas)).waitingOnYou).toBe(0);
    });

    it("refuses an accept from an introducer who left", async () => {
      await leave(jonas);

      expect((await transition(jonas, intro.id, INTRO_ACTIONS.accept)).status).toBe(CONFLICT_STATUS);
      expect(await readState(intro.id)).toBe(INTRO_STATES.expired);
    });

    it("refuses to finish an ask once the requester left", async () => {
      await transition(jonas, intro.id, INTRO_ACTIONS.accept);
      await leave(amara);

      expect((await transition(jonas, intro.id, INTRO_ACTIONS.complete)).status).toBe(CONFLICT_STATUS);
    });

    it("leaves closed asks as they were", async () => {
      await transition(jonas, intro.id, INTRO_ACTIONS.decline);
      await leave(jonas);

      expect((await readBoard(amara)).yourAsks[0]?.state).toBe(INTRO_STATES.declined);
    });
  });

  describe("who can see an ask", () => {
    let intro: Intro;

    beforeEach(async () => {
      intro = await createIntro();
    });

    it("answers a non-participant exactly like an unknown ID", async () => {
      const notYours = await call(postDetail, bystander, { introId: intro.id });
      const unknown = await call(postDetail, bystander, { introId: UNKNOWN_ID });

      expect(notYours.status).toBe(NOT_FOUND_STATUS);
      expect(await notYours.text()).toBe(await unknown.text());
    });

    it("hides an ask from a non-participant's lists and counts", async () => {
      const board = await readBoard(bystander);

      expect(board.asksForYou).toEqual([]);
      expect(board.yourAsks).toEqual([]);
      expect(board.counts).toEqual({ waitingOnYou: 0, updates: 0 });
    });

    it("refuses a non-participant's move", async () => {
      expect((await transition(bystander, intro.id, INTRO_ACTIONS.accept)).status).toBe(NOT_FOUND_STATUS);
      expect((await transition(bystander, intro.id, INTRO_ACTIONS.withdraw)).status).toBe(NOT_FOUND_STATUS);
    });

    it("refuses an admin who isn't a participant", async () => {
      expect((await call(postDetail, admin, { introId: intro.id })).status).toBe(NOT_FOUND_STATUS);
      expect((await transition(admin, intro.id, INTRO_ACTIONS.accept)).status).toBe(NOT_FOUND_STATUS);
    });

    it("gives admins counts by state and nothing else", async () => {
      const counts = await readIntroStateCounts(database);

      expect(counts.find(({ state }) => state === INTRO_STATES.requested)?.count).toBe(1);
      expect(JSON.stringify(counts)).not.toContain(NOTE);
      expect(Object.keys(counts[0] ?? {}).toSorted()).toEqual(["count", "state"]);
    });

    it("hides a banned requester's ask from the introducer until the ban ends", async () => {
      await database.update(user).set({ banned: true }).where(eq(user.id, amara.userId));

      expect((await readBoard(jonas)).asksForYou).toEqual([]);
      expect((await call(postDetail, jonas, { introId: intro.id })).status).toBe(NOT_FOUND_STATUS);
    });

    it("shows each participant their own role", async () => {
      expect((await readBoard(jonas)).asksForYou[0]?.viewerRole).toBe(INTRO_ROLES.introducer);
      expect((await readBoard(amara)).yourAsks[0]?.viewerRole).toBe(INTRO_ROLES.requester);
    });
  });

  describe("the badge counts", () => {
    it("counts asks waiting on the introducer until they're answered and finished", async () => {
      const intro = await createIntro();

      expect((await readCounts(jonas)).waitingOnYou).toBe(1);
      await transition(jonas, intro.id, INTRO_ACTIONS.accept);
      expect((await readCounts(jonas)).waitingOnYou).toBe(1);
      await transition(jonas, intro.id, INTRO_ACTIONS.complete);
      expect((await readCounts(jonas)).waitingOnYou).toBe(0);
    });

    it("counts news for the requester until they've seen it", async () => {
      const intro = await createIntro();
      await transition(jonas, intro.id, INTRO_ACTIONS.accept);

      expect((await readCounts(amara)).updates).toBe(1);
      await call(postSeen, amara, { introId: null });
      expect((await readCounts(amara)).updates).toBe(0);
    });

    it("marks only the ask that was opened", async () => {
      const first = await createIntro();
      const second = await createIntro(amara, { connectorSlug: NOOR_SLUG });
      await transition(jonas, first.id, INTRO_ACTIONS.accept);
      await transition(noor, second.id, INTRO_ACTIONS.accept);

      await call(postSeen, amara, { introId: first.id });

      expect((await readCounts(amara)).updates).toBe(1);
    });

    it("doesn't let a member clear someone else's news", async () => {
      const intro = await createIntro();
      await transition(jonas, intro.id, INTRO_ACTIONS.accept);

      await call(postSeen, bystander, { introId: intro.id });

      expect((await readCounts(amara)).updates).toBe(1);
    });

    it("gives the requester no news for their own withdrawal", async () => {
      const intro = await createIntro();
      await transition(amara, intro.id, INTRO_ACTIONS.withdraw);

      expect((await readCounts(amara)).updates).toBe(0);
    });
  });

  describe("email", () => {
    function readEmailBodies() {
      return JSON.stringify(resend.state.emails.map(({ body }) => body));
    }

    it("emails the introducer about a new ask, without the note", async () => {
      configureResend();

      await createIntro();

      await vi.waitFor(() => expect(resend.state.emails).toHaveLength(1), EVENTUALLY);
      const bodies = readEmailBodies();
      expect(bodies).toContain(jonas.email);
      expect(bodies).toContain("Clara Bergström");
      expect(bodies).toContain(`${APP_URL}/intros/`);
      expect(bodies).not.toContain(NOTE);
      expect(bodies).not.toContain("Corvane");
    });

    it("emails the requester on accept and on decline, without any reason", async () => {
      const accepted = await createIntro();
      const declined = await createIntro(amara, { connectorSlug: NOOR_SLUG });
      configureResend();

      await transition(jonas, accepted.id, INTRO_ACTIONS.accept);
      await transition(noor, declined.id, INTRO_ACTIONS.decline, { reason: "Private thoughts" });

      await vi.waitFor(() => expect(resend.state.emails).toHaveLength(2), EVENTUALLY);
      expect(readEmailBodies()).toContain(amara.email);
      expect(readEmailBodies()).not.toContain("Private thoughts");
    });

    describe("cooling down new-ask emails", () => {
      async function askAndWithdraw(times: number) {
        await lookUpPaths();
        for (let attempt = 0; attempt < times; attempt += 1) {
          const intro = introSchema.parse(await (await ask()).json());
          await transition(amara, intro.id, INTRO_ACTIONS.withdraw);
          await vi.waitFor(() => expect(resend.state.emails.length).toBeGreaterThan(0), EVENTUALLY);
        }
      }

      it("sends one email however often a requester asks and withdraws", async () => {
        configureResend();

        await askAndWithdraw(EMAIL_CYCLES);
        await vi.waitFor(() => expect(resend.state.emails.length).toBeGreaterThan(0), EVENTUALLY);
        await new Promise((resolve) => setTimeout(resolve, EMAIL_SETTLE_MS));

        expect(resend.state.emails).toHaveLength(1);
      });

      it("still shows the newest ask on the badge", async () => {
        configureResend();

        await askAndWithdraw(EMAIL_CYCLES);
        await ask();

        expect((await readCounts(jonas)).waitingOnYou).toBe(1);
      });

      it("emails a different introducer", async () => {
        configureResend();
        await askAndWithdraw(1);

        await ask(amara, { connectorSlug: NOOR_SLUG });

        await vi.waitFor(() => expect(resend.state.emails).toHaveLength(2), EVENTUALLY);
      });

      it("emails again after the cooldown", async () => {
        configureResend();
        await askAndWithdraw(1);
        await database.update(introRequest).set({ askedEmailAt: new Date(Date.now() - ASKED_EMAIL_COOLDOWN_MS - 1) });

        await ask();

        await vi.waitFor(() => expect(resend.state.emails).toHaveLength(2), EVENTUALLY);
      });
    });

    it("sends nothing for withdraw or mark as introduced", async () => {
      const first = await createIntro();
      const second = await createIntro(amara, { connectorSlug: NOOR_SLUG });
      await transition(noor, second.id, INTRO_ACTIONS.accept);
      configureResend();

      await transition(amara, first.id, INTRO_ACTIONS.withdraw);
      await transition(noor, second.id, INTRO_ACTIONS.complete);
      await new Promise((resolve) => setTimeout(resolve, EMAIL_SETTLE_MS));

      expect(resend.state.emails).toEqual([]);
    });

    it("keeps the action working when sending fails", async () => {
      configureResend();
      resend.state.failureStatus = SERVER_ERROR_STATUS;
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const intro = await createIntro();

      expect(intro.state).toBe(INTRO_STATES.requested);
      await vi.waitFor(() => expect(logged).toHaveBeenCalled(), EVENTUALLY);
      vi.restoreAllMocks();
    });

    it("works by badge alone without Resend", async () => {
      await createIntro();

      expect(resend.state.emails).toEqual([]);
      expect((await readCounts(jonas)).waitingOnYou).toBe(1);
    });
  });

  async function makeIntroOverdueSoon(introId: string) {
    await database
      .update(introRequest)
      .set({ expiresAt: new Date(Date.now() + MILLISECONDS_PER_DAY) })
      .where(eq(introRequest.id, introId));
  }
});
