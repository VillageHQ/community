import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postReportDelete } from "@/app/api/admin/reports/delete-content/route";
import { POST as postReportList } from "@/app/api/admin/reports/list/route";
import { POST as postBoard } from "@/app/api/asks/route";
import { POST as postAllowance } from "@/app/api/asks/allowance/route";
import { POST as postAnswer } from "@/app/api/asks/answer/route";
import { POST as postAskHelper } from "@/app/api/asks/ask-helper/route";
import { POST as postCreate } from "@/app/api/asks/create/route";
import { POST as postKnowSomeone } from "@/app/api/asks/know-someone/route";
import { POST as postOwn } from "@/app/api/asks/own/route";
import { POST as postReportAnswer } from "@/app/api/asks/report-answer/route";
import { POST as postIntroCreate } from "@/app/api/intros/create/route";
import { POST as postTransition } from "@/app/api/intros/transition/route";
import { POST as postBlock } from "@/app/api/members/block/route";
import { POST as postPaths } from "@/app/api/network/paths/route";
import { REPORT_FILTERS, REPORT_TARGETS, reportPageSchema } from "@/modules/admin/contract";
import {
  ASK_ALLOWANCE,
  ASK_CATEGORIES,
  ASK_ERROR_CODES,
  ASK_HELPER_REASONS,
  ASK_KINDS,
  askBoardPageSchema,
  createdAnswerSchema,
  createdAskSchema,
  createdIntroSchema,
  ownAsksSchema,
} from "@/modules/asks/contract";
import { asksManifest } from "@/modules/asks/manifest";
import { askHelper } from "@/modules/asks/schema";
import { INTRO_ACTIONS, INTRO_ERROR_CODES, INTRO_STATES } from "@/modules/intros/contract";
import { introRequest } from "@/modules/intros/schema";
import { CONNECTOR_WEEKLY_CAP } from "@/modules/intros/service";
import { memberProfile } from "@/modules/members/schema";
import { saveVillageGroup } from "@/modules/network/service-settings";
import { EMAIL_KINDS, EMAIL_TOPICS } from "@/platform/email/kinds";
import { emailOutbox } from "@/platform/email/schema";
import { setEmailTopic } from "@/platform/email/unsubscribe";
import { saveModuleState } from "@/platform/modules/enablement";
import { saveVillageKeys } from "@/platform/village/settings";
import { EVENTUALLY } from "@/test/async-timeouts";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { joinMemberToGroup, nameMember } from "@/test/intros";
import { createSignedInMember } from "@/test/signed-in-member";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const TARGET_SLUG = "clara-bergstrom";
const TARGET_URL = `https://www.linkedin.com/in/${TARGET_SLUG}`;
const AMARA_SLUG = "amara-osei";
const JONAS_SLUG = "jonas-lindqvist";
const NOOR_SLUG = "noor-haddad";
const BYSTANDER_SLUG = "bystander";
const FREIGHT_ASK = "Looking for someone who knows freight pricing";
const NOTE = "I'd love to meet Clara about freight pricing.";
const DAY_MS = 24 * 60 * 60 * 1000;

const AMARA = { first_name: "Amara", last_name: "Osei", linkedin_url: `https://www.linkedin.com/in/${AMARA_SLUG}` };
const JONAS = { first_name: "Jonas", last_name: "Lindqvist", linkedin_url: `https://www.linkedin.com/in/${JONAS_SLUG}`, headline: "CTO, Ledgerline" };

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;

function call(handler: Handler, member: Member | null, body: unknown = {}) {
  return handler(
    new Request(`${APP_URL}/api/asks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP_URL, ...(member ? { Cookie: member.cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
}

describe("asks that reach helpers", () => {
  const database = createTestDatabase();
  let village: Awaited<ReturnType<typeof startFakeVillageServer>>;
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let amara: Member;
  let jonas: Member;
  let noor: Member;
  let bystander: Member;
  let gardener: Member;
  let admin: Member;

  async function setCanHelpWith(member: Member, canHelpWith: string) {
    await database.insert(memberProfile).values({ userId: member.userId, canHelpWith }).onConflictDoUpdate({ target: memberProfile.userId, set: { canHelpWith } });
  }

  async function post(member: Member, overrides: Record<string, unknown> = {}) {
    const response = await call(postCreate, member, { title: FREIGHT_ASK, category: ASK_CATEGORIES.intro, targetLinkedin: TARGET_URL, ...overrides });
    expect(response.status).toBe(OK_STATUS);
    return createdAskSchema.parse(await response.json());
  }

  async function readOwn(member: Member) {
    return ownAsksSchema.parse(await (await call(postOwn, member)).json());
  }

  async function readBoard(member: Member) {
    return askBoardPageSchema.parse(await (await call(postBoard, member, {})).json());
  }

  function readHelperEmails() {
    return database.select({ memberId: emailOutbox.memberId, subject: emailOutbox.subject, text: emailOutbox.text }).from(emailOutbox).where(eq(emailOutbox.kind, EMAIL_KINDS.askHelper));
  }

  function block(blocker: Member, blocked: Member) {
    return call(postBlock, blocker, { memberId: blocked.userId, isBlocked: true });
  }

  beforeAll(async () => {
    village = await startFakeVillageServer();
    resend = await startFakeResendServer();
    process.env.VILLAGE_API_URL = village.url;
    process.env.VILLAGE_APP_URL = "https://app.village.test";
  });

  afterAll(async () => {
    delete process.env.VILLAGE_API_URL;
    delete process.env.VILLAGE_APP_URL;
    await village.stop();
    await resend.stop();
    await database.$client.end();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    village.reset();
    resend.reset();
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.com>");
    vi.stubEnv("RESEND_API_URL", resend.url);
    await saveModuleState(database, asksManifest, true);
    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    await saveVillageGroup(database, { id: "group-1", inviteLink: "https://village.test/join/invite-code" });
    [amara, jonas, noor, bystander, gardener, admin] = await Promise.all([
      createSignedInMember(database),
      createSignedInMember(database),
      createSignedInMember(database),
      createSignedInMember(database),
      createSignedInMember(database),
      createSignedInMember(database, "admin"),
    ]);
    const joined: [Member, string][] = [
      [amara, AMARA_SLUG],
      [jonas, JONAS_SLUG],
      [noor, NOOR_SLUG],
      [bystander, BYSTANDER_SLUG],
    ];
    for (const [member, slug] of joined) {
      const externalId = await joinMemberToGroup(database, member.userId, slug);
      village.state.linkedMembers.set(externalId, { status: "ready", email: member.email });
    }
    await nameMember(database, amara.userId, "Amara Osei");
    await nameMember(database, jonas.userId, "Jonas Lindqvist");
    await nameMember(database, noor.userId, "Noor Haddad");
    await setCanHelpWith(noor, "Freight pricing and logistics");
    await setCanHelpWith(gardener, "Gardening and composting");
    village.state.pathsByUrl.set(TARGET_URL, {
      summary: "🟢 Jonas Lindqvist can intro (via Amara Osei)",
      target: { full_name: "Clara Bergström" },
      paths: [
        {
          degree: 2,
          description: "🟢 Jonas Lindqvist can intro (via Amara Osei)",
          introducer: JONAS,
          starter: AMARA,
          isStarterCurrentUser: true,
          introducerMeta: [{ title: "Work", description: "Both worked at Corvane Logistics" }],
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("routing a new ask", () => {
    it("emails the path helper and the word helper once each, and never a blocked member", async () => {
      await setCanHelpWith(bystander, "Freight brokers");
      expect((await block(bystander, amara)).status).toBe(OK_STATUS);

      const { id, helperCount } = await post(amara);

      expect(helperCount).toBe(2);
      const emails = await readHelperEmails();
      expect(emails.map(({ memberId }) => memberId).toSorted()).toEqual([jonas.userId, noor.userId].toSorted());
      expect(emails.find(({ memberId }) => memberId === jonas.userId)?.text).toContain("May know Clara Bergström");
      const rows = await database.select({ helperId: askHelper.helperId, reason: askHelper.reason }).from(askHelper).where(eq(askHelper.askId, id));
      expect(rows).toHaveLength(2);
      expect(rows.find(({ helperId }) => helperId === jonas.userId)?.reason).toBe(ASK_HELPER_REASONS.path);
      expect(rows.find(({ helperId }) => helperId === noor.userId)?.reason).toBe(ASK_HELPER_REASONS.words);

      await vi.waitFor(() => expect(resend.state.emails).toHaveLength(2), EVENTUALLY);
      const sent = JSON.stringify(resend.state.emails.map(({ body }) => body));
      expect(sent).toContain("List-Unsubscribe-Post");
      expect(sent).not.toContain(bystander.email);
    });

    it("shows the author who may help, and tells each helper why", async () => {
      await post(amara);

      const [own] = (await readOwn(amara)).asks;
      expect(own?.target).toEqual({ linkedinSlug: TARGET_SLUG, name: "Clara Bergström" });
      expect(own?.helpers.map(({ helper, canAskForIntro }) => [helper.id, canAskForIntro])).toEqual([
        [jonas.userId, true],
        [noor.userId, false],
      ]);
      expect((await readBoard(noor)).asks[0]?.whyYou).toBe('Can help with "Freight pricing and logistics"');
      expect((await readBoard(gardener)).asks[0]?.whyYou).toBeNull();
    });

    it("lists a helper who turned these emails off, without emailing them", async () => {
      await setEmailTopic(database, { memberId: noor.userId, topic: EMAIL_TOPICS.asks }, false);

      const { helperCount } = await post(amara);

      expect(helperCount).toBe(2);
      expect((await readHelperEmails()).map(({ memberId }) => memberId)).toEqual([jonas.userId]);
    });

    it("still finds word helpers when the ask names nobody, or Village is down", async () => {
      village.state.pathsByUrl.clear();
      expect((await post(amara, { targetLinkedin: null })).helperCount).toBe(1);
      expect((await post(amara, { title: "Need help with freight pricing for Europe" })).helperCount).toBe(1);
    });

    it("refuses a link that isn't a LinkedIn profile, and junk typed as a profile name", async () => {
      for (const targetLinkedin of ["https://example.com/somebody", "javascript:alert(1)", "a b c", "‮evil", "clara%22onmouseover%3Dalert(1)"]) {
        const response = await call(postCreate, amara, { title: FREIGHT_ASK, category: ASK_CATEGORIES.intro, targetLinkedin });
        expect(response.status).toBe(UNPROCESSABLE_STATUS);
      }
      expect((await post(amara, { targetLinkedin: TARGET_SLUG })).id).toBeTruthy();
    });

    it("posts the ask when every helper it finds is blocked", async () => {
      await setCanHelpWith(noor, "Gardening");
      await block(amara, jonas);

      const { helperCount } = await post(amara);

      expect(helperCount).toBe(0);
      expect(await readHelperEmails()).toEqual([]);
    });

    it("emails nobody about an update, and doesn't use the allowance", async () => {
      const { helperCount } = await post(amara, { kind: ASK_KINDS.update, title: "We closed our first freight customer", category: ASK_CATEGORIES.other, targetLinkedin: null });

      expect(helperCount).toBe(0);
      expect(await readHelperEmails()).toEqual([]);
      expect((await readOwn(amara)).allowance.used).toBe(0);
      expect((await readBoard(noor)).asks[0]?.kind).toBe(ASK_KINDS.update);
    });
  });

  describe("I know someone", () => {
    it("starts exactly one intro, with the helper as the connector, even on a double tap", async () => {
      const { id: askId } = await post(amara);
      const body = { askId, note: "I know Pat well.", targetLinkedin: "https://www.linkedin.com/in/pat-lee", targetName: "Pat Lee" };

      const responses = await Promise.all([call(postKnowSomeone, noor, body), call(postKnowSomeone, noor, body)]);

      expect(responses.map(({ status }) => status).toSorted()).toEqual([OK_STATUS, CONFLICT_STATUS]);
      const intros = await database.select().from(introRequest);
      expect(intros).toHaveLength(1);
      expect(intros[0]).toMatchObject({
        requesterId: amara.userId,
        introducerId: noor.userId,
        targetLinkedinSlug: "pat-lee",
        targetName: "Pat Lee",
        state: INTRO_STATES.askingTarget,
        askId,
        isConnectorOffer: true,
      });
      expect((await readOwn(amara)).asks[0]?.offers.map(({ helper }) => helper.id)).toEqual([noor.userId]);
    });

    it("cleans the person's name instead of failing on hidden characters", async () => {
      const { id: askId } = await post(amara);

      const response = await call(postKnowSomeone, noor, { askId, note: "Hi", targetLinkedin: "pat-lee", targetName: "Pat  ‮Lee" });

      expect(response.status).toBe(OK_STATUS);
      const [intro] = await database.select({ targetName: introRequest.targetName }).from(introRequest);
      expect(intro?.targetName).toBe("Pat Lee");
    });

    it("uses the person the ask names when the helper leaves the fields blank", async () => {
      const { id: askId } = await post(amara);

      const response = await call(postKnowSomeone, jonas, { askId, note: "Clara and I worked together." });

      expect(response.status).toBe(OK_STATUS);
      const { introId } = createdIntroSchema.parse(await response.json());
      const [intro] = await database.select().from(introRequest).where(eq(introRequest.id, introId));
      expect(intro).toMatchObject({ targetLinkedinSlug: TARGET_SLUG, targetName: "Clara Bergström", introducerId: jonas.userId });
    });

    it("doesn't use the author's allowance or the connector's weekly cap", async () => {
      const { id: askId } = await post(amara);
      await call(postKnowSomeone, jonas, { askId, note: "Clara and I worked together." });

      expect((await readOwn(amara)).allowance.used).toBe(1);
    });

    it("is closed to a member the author blocked, and to the author", async () => {
      const { id: askId } = await post(amara);
      await block(amara, noor);

      expect((await call(postKnowSomeone, noor, { askId, note: "Hi" })).status).toBe(NOT_FOUND_STATUS);
      expect((await call(postKnowSomeone, amara, { askId, note: "Hi" })).status).toBe(UNPROCESSABLE_STATUS);
      expect(await database.select().from(introRequest)).toEqual([]);
    });
  });

  describe("the author asking a helper", () => {
    it("asks a path helper for the intro, as an intro ask tied to the ask", async () => {
      const { id: askId } = await post(amara);

      const response = await call(postAskHelper, amara, { askId, helperId: jonas.userId, note: NOTE });

      expect(response.status).toBe(OK_STATUS);
      const [intro] = await database.select().from(introRequest);
      expect(intro).toMatchObject({ requesterId: amara.userId, introducerId: jonas.userId, state: INTRO_STATES.requested, askId, isConnectorOffer: false });
    });

    it("refuses a word helper, who has no known path", async () => {
      const { id: askId } = await post(amara);

      expect((await call(postAskHelper, amara, { askId, helperId: noor.userId, note: NOTE })).status).toBe(NOT_FOUND_STATUS);
    });
  });

  describe("the weekly allowance", () => {
    it("blocks the sixth ask and comes back when an intro ask is declined", async () => {
      const { id: firstAskId } = await post(amara);
      for (let position = 0; position < 3; position += 1) await post(amara, { title: `Freight question ${position}`, targetLinkedin: null });
      const intro = await call(postAskHelper, amara, { askId: firstAskId, helperId: jonas.userId, note: NOTE });
      const { introId } = createdIntroSchema.parse(await intro.json());
      expect((await readOwn(amara)).allowance).toMatchObject({ cap: ASK_ALLOWANCE.default, used: 5, left: 0 });

      const sixth = await call(postCreate, amara, { title: "One more", category: ASK_CATEGORIES.other });
      expect(sixth.status).toBe(CONFLICT_STATUS);
      expect(await sixth.json()).toMatchObject({ code: ASK_ERROR_CODES.allowanceUsed });

      expect((await call(postTransition, jonas, { introId, action: INTRO_ACTIONS.decline })).status).toBe(OK_STATUS);
      expect((await readOwn(amara)).allowance.left).toBe(1);
      expect((await call(postCreate, amara, { title: "One more", category: ASK_CATEGORIES.other })).status).toBe(OK_STATUS);
    });

    it("counts an intro ask made from the Intros page too", async () => {
      for (let position = 0; position < ASK_ALLOWANCE.default; position += 1) await post(amara, { title: `Freight question ${position}`, targetLinkedin: null });
      await call(postPaths, amara, { linkedinSlug: TARGET_SLUG });

      const response = await call(postIntroCreate, amara, { targetSlug: TARGET_SLUG, connectorSlug: JONAS_SLUG, note: NOTE });

      expect(response.status).toBe(CONFLICT_STATUS);
      expect(await response.json()).toMatchObject({ code: ASK_ERROR_CODES.allowanceUsed });
    });

    it("gives an ask back a week after it was posted", async () => {
      for (let position = 0; position < ASK_ALLOWANCE.default; position += 1) await post(amara, { title: `Freight question ${position}`, targetLinkedin: null });
      const [oldest] = (await readOwn(amara)).asks.toReversed();
      const { ask } = await import("@/modules/asks/schema");
      await database.update(ask).set({ createdAt: new Date(Date.now() - 8 * DAY_MS) }).where(eq(ask.id, oldest?.id ?? ""));

      expect((await readOwn(amara)).allowance.left).toBe(1);
    });

    it("holds when asks arrive at the same moment", async () => {
      const responses = await Promise.all(
        Array.from({ length: ASK_ALLOWANCE.default + 2 }, (_unused, position) => call(postCreate, amara, { title: `Ask ${position}`, category: ASK_CATEGORIES.other })),
      );

      expect(responses.filter(({ status }) => status === OK_STATUS)).toHaveLength(ASK_ALLOWANCE.default);
    });

    it("can be changed by an admin only, from 1 to 100", async () => {
      expect((await call(postAllowance, amara, { weeklyAllowance: 50 })).status).toBe(FORBIDDEN_STATUS);
      expect((await call(postAllowance, admin, { weeklyAllowance: 0 })).status).toBe(UNPROCESSABLE_STATUS);
      expect((await call(postAllowance, admin, { weeklyAllowance: 101 })).status).toBe(UNPROCESSABLE_STATUS);
      expect((await call(postAllowance, admin, { weeklyAllowance: 1 })).status).toBe(OK_STATUS);

      await post(amara, { targetLinkedin: null });
      expect((await call(postCreate, amara, { title: "Second", category: ASK_CATEGORIES.other })).status).toBe(CONFLICT_STATUS);
    });
  });

  describe("the connector's weekly cap", () => {
    it("blocks the eleventh intro ask to one connector in a week", async () => {
      const now = new Date();
      const others = await Promise.all(Array.from({ length: CONNECTOR_WEEKLY_CAP }, () => createSignedInMember(database)));
      for (const [position, other] of others.entries()) {
        await joinMemberToGroup(database, other.userId, `requester-${position}`);
        await database.insert(introRequest).values({
          requesterId: other.userId,
          introducerId: jonas.userId,
          targetLinkedinSlug: `someone-${position}`,
          targetName: "Someone",
          introducerName: "Jonas Lindqvist",
          introducerLinkedinSlug: JONAS_SLUG,
          reason: "Knows them",
          note: "Hello",
          createdAt: now,
          expiresAt: new Date(now.getTime() + 14 * DAY_MS),
        });
      }
      await call(postPaths, amara, { linkedinSlug: TARGET_SLUG });

      const response = await call(postIntroCreate, amara, { targetSlug: TARGET_SLUG, connectorSlug: JONAS_SLUG, note: NOTE });

      expect(response.status).toBe(CONFLICT_STATUS);
      expect(await response.json()).toMatchObject({ code: INTRO_ERROR_CODES.connectorBusy });
      expect(await database.select().from(introRequest).where(eq(introRequest.requesterId, amara.userId))).toEqual([]);
      expect((await readOwn(amara)).allowance.used).toBe(0);
    });
  });

  describe("answers", () => {
    it("posts one answer under an ask, which anyone can report and an admin can remove", async () => {
      const { id: askId } = await post(amara);
      const first = await call(postAnswer, noor, { askId, body: "We priced by lane, and it worked." });
      const again = await call(postAnswer, noor, { askId, body: "Twice" });
      const { id: answerId } = createdAnswerSchema.parse(await first.json());
      expect(createdAnswerSchema.parse(await again.json())).toEqual({ id: answerId, wasAlreadyAnswered: true });
      expect((await readBoard(gardener)).asks[0]?.answers.map(({ body }) => body)).toEqual(["We priced by lane, and it worked."]);

      expect((await call(postReportAnswer, noor, { answerId })).status).toBe(UNPROCESSABLE_STATUS);
      expect((await call(postReportAnswer, gardener, { answerId })).status).toBe(OK_STATUS);
      const { reports } = reportPageSchema.parse(await (await call(postReportList, admin, { filter: REPORT_FILTERS.open })).json());
      expect(reports).toEqual([expect.objectContaining({ targetType: REPORT_TARGETS.askAnswer, body: expect.stringContaining("We priced by lane") })]);

      const removed = await call(postReportDelete, admin, { reportId: reports[0]?.id, targetType: REPORT_TARGETS.askAnswer });
      expect(removed.status).toBe(OK_STATUS);
      expect((await readBoard(gardener)).asks[0]?.answers).toEqual([]);
    });

    it("can't go on your own ask or on an update", async () => {
      const { id: askId } = await post(amara);
      const { id: updateId } = await post(amara, { kind: ASK_KINDS.update, title: "We won", category: ASK_CATEGORIES.other, targetLinkedin: null });

      expect((await call(postAnswer, amara, { askId, body: "Me" })).status).toBe(UNPROCESSABLE_STATUS);
      expect((await call(postAnswer, noor, { askId: updateId, body: "Nice" })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("hides an answer from a member who blocked its author", async () => {
      const { id: askId } = await post(amara);
      await call(postAnswer, noor, { askId, body: "We priced by lane." });
      await block(gardener, noor);

      expect((await readBoard(gardener)).asks[0]?.answers).toEqual([]);
      const rows = await database.select().from(askHelper).where(and(eq(askHelper.askId, askId), eq(askHelper.helperId, gardener.userId)));
      expect(rows).toEqual([]);
    });
  });

  it("lets an update be reported like an ask", async () => {
    const { id } = await post(amara, { kind: ASK_KINDS.update, title: "We won", category: ASK_CATEGORIES.other, targetLinkedin: null });
    const { POST: postReport } = await import("@/app/api/asks/report/route");

    expect((await call(postReport, noor, { askId: id })).status).toBe(OK_STATUS);
  });
});
