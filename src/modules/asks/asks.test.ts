import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as postRemoveMember } from "@/app/api/admin/members/remove/route";
import { POST as postDeleteReported } from "@/app/api/admin/reports/delete-content/route";
import { POST as postDismissReport } from "@/app/api/admin/reports/dismiss/route";
import { POST as postReportList } from "@/app/api/admin/reports/list/route";
import { POST as postBoard } from "@/app/api/asks/route";
import { POST as postClose } from "@/app/api/asks/close/route";
import { POST as postCounts } from "@/app/api/asks/counts/route";
import { POST as postCreate } from "@/app/api/asks/create/route";
import { POST as postOffer } from "@/app/api/asks/offer/route";
import { POST as postOwn } from "@/app/api/asks/own/route";
import { POST as postRemove } from "@/app/api/asks/remove/route";
import { POST as postRenew } from "@/app/api/asks/renew/route";
import { POST as postReport } from "@/app/api/asks/report/route";
import { POST as postSeen } from "@/app/api/asks/seen/route";
import { POST as postBlock } from "@/app/api/members/block/route";
import { REPORT_FILTERS, REPORT_TARGETS, reportPageSchema } from "@/modules/admin/contract";
import {
  ASK_ALLOWANCE,
  ASK_ALLOWANCE_SETTING,
  ASK_CATEGORIES,
  ASK_ERROR_CODES,
  ASK_LIMITS,
  ASK_OUTCOMES,
  ASK_STATES,
  askBoardPageSchema,
  askCountsSchema,
  createdAskSchema,
  offerResultSchema,
  ownAsksSchema,
} from "@/modules/asks/contract";
import { asksManifest } from "@/modules/asks/manifest";
import { ask, askOffer } from "@/modules/asks/schema";
import { ASK_MAXIMUM_PER_MINUTE, ASK_POSTING_KINDS } from "@/modules/asks/limits";
import { conversation, directMessage } from "@/modules/messages/schema";
import { MESSAGING_KINDS, MESSAGING_MAXIMUM_PER_MINUTE } from "@/modules/messages/limits";
import { messagesManifest } from "@/modules/messages/manifest";
import { toConversationPair } from "@/modules/messages/rules-conversation-pair";
import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { adminAuditEntry } from "@/platform/audit/schema";
import { user } from "@/platform/database/auth-schema";
import { saveModuleState } from "@/platform/modules/enablement";
import { saveSettings } from "@/platform/settings/store";
import { recordFailedAttempt } from "@/platform/rate-limit/attempt-rate-limit";
import { readEnabledIds, readModuleBadges } from "@/shell/enabled-modules";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { createSignedInMember } from "@/test/signed-in-member";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const TOO_MANY_REQUESTS_STATUS = 429;
const DAY_MS = 24 * 60 * 60 * 1000;
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const CFO_ASK = "Looking for a fractional CFO who's done a Series A";
const NOTE = "I hired one last year. Happy to connect you.";

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

describe("asks", () => {
  const database = createTestDatabase();
  let asker: Member;
  let helper: Member;
  let bystander: Member;
  let admin: Member;

  async function createAsk(member: Member, overrides: Record<string, unknown> = {}) {
    const response = await call(postCreate, member, { title: CFO_ASK, category: ASK_CATEGORIES.hire, ...overrides });
    expect(response.status).toBe(OK_STATUS);
    return createdAskSchema.parse(await response.json()).id;
  }

  async function readBoard(member: Member, body: Record<string, unknown> = {}) {
    return askBoardPageSchema.parse(await (await call(postBoard, member, body)).json());
  }

  async function readBoardTitles(member: Member, body: Record<string, unknown> = {}) {
    return (await readBoard(member, body)).asks.map(({ title }) => title);
  }

  async function readOwn(member: Member) {
    return ownAsksSchema.parse(await (await call(postOwn, member)).json());
  }

  async function readNewOffers(member: Member) {
    return askCountsSchema.parse(await (await call(postCounts, member)).json()).newOffers;
  }

  async function offer(member: Member, askId: string, note = NOTE) {
    return call(postOffer, member, { askId, note });
  }

  async function ageAsk(askId: string, days: number) {
    await database.update(ask).set({ listedAt: new Date(Date.now() - days * DAY_MS) }).where(eq(ask.id, askId));
  }

  function block(blocker: Member, blocked: Member, isBlocked = true) {
    return call(postBlock, blocker, { memberId: blocked.userId, isBlocked });
  }

  function readMessageBodies() {
    return database.select({ body: directMessage.body, senderId: directMessage.senderId, conversationId: directMessage.conversationId }).from(directMessage);
  }

  beforeAll(async () => {
    await clearDatabase(database);
  });

  beforeEach(async () => {
    await clearDatabase(database);
    await saveModuleState(database, asksManifest, true);
    // The weekly allowance has its own tests (asks-helpers.test.ts). Here it stays out of the open limit's way.
    await saveSettings(database, { [ASK_ALLOWANCE_SETTING]: String(ASK_ALLOWANCE.maximum) });
    [asker, helper, bystander, admin] = await Promise.all([
      createSignedInMember(database),
      createSignedInMember(database),
      createSignedInMember(database),
      createSignedInMember(database, "admin"),
    ]);
    await database.update(user).set({ name: "Maya Asker" }).where(eq(user.id, asker.userId));
    await database.update(user).set({ name: "Sam Helper" }).where(eq(user.id, helper.userId));
  });

  describe("access", () => {
    it("turns away someone who isn't signed in", async () => {
      expect((await call(postBoard, null)).status).toBe(UNAUTHORIZED_STATUS);
      expect((await call(postCreate, null, { title: CFO_ASK, category: ASK_CATEGORIES.hire })).status).toBe(UNAUTHORIZED_STATUS);
    });

    it("is on for a new community, and an admin can turn it off", async () => {
      await clearDatabase(database);
      const member = await createSignedInMember(database);

      expect((await readEnabledIds(database)).has(asksManifest.id)).toBe(true);
      await saveModuleState(database, asksManifest, false);
      expect((await call(postBoard, member)).status).toBe(NOT_FOUND_STATUS);
    });

    it("needs nothing from Village", () => {
      expect(asksManifest.needsVillage).toBe(false);
      expect(asksManifest.requires).toEqual([]);
    });
  });

  describe("posting an ask", () => {
    it("puts a short title, a detail and a category on the board", async () => {
      const askId = await createAsk(asker, { detail: "Budget for two days a week." });

      const { asks } = await readBoard(helper);

      expect(asks).toEqual([
        expect.objectContaining({
          id: askId,
          title: CFO_ASK,
          detail: "Budget for two days a week.",
          category: ASK_CATEGORIES.hire,
          offerCount: 0,
          isMine: false,
          myOffer: null,
          author: expect.objectContaining({ id: asker.userId, name: "Maya Asker" }),
        }),
      ]);
    });

    it("leaves the detail out when the member gives none", async () => {
      await createAsk(asker);

      expect((await readBoard(helper)).asks[0]?.detail).toBeNull();
    });

    it.each(Object.values(ASK_CATEGORIES))("accepts the category %s", async (category) => {
      await createAsk(asker, { category });

      expect((await readBoard(asker)).asks[0]?.category).toBe(category);
    });

    it("refuses an unknown category", async () => {
      const response = await call(postCreate, asker, { title: CFO_ASK, category: "investor" });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
    });

    it("explains a missing category in plain words", async () => {
      const response = await call(postCreate, asker, { title: CFO_ASK, category: null });

      expect(await response.json()).toMatchObject({ message: "Choose what kind of help you need." });
    });

    it.each([
      ["an empty title", ""],
      ["only spaces", "     "],
      ["a title over the limit", "x".repeat(ASK_LIMITS.titleLength + 1)],
    ])("refuses %s", async (_label, title) => {
      expect((await call(postCreate, asker, { title, category: ASK_CATEGORIES.advice })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses a detail over the limit", async () => {
      const response = await call(postCreate, asker, { title: CFO_ASK, category: ASK_CATEGORIES.advice, detail: "x".repeat(ASK_LIMITS.detailLength + 1) });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
    });

    it("folds line breaks in a title into one line", async () => {
      await createAsk(asker, { title: "Looking\nfor   a CFO" });

      expect(await readBoardTitles(asker)).toEqual(["Looking for a CFO"]);
    });

    it("stores markup as plain text", async () => {
      const markup = `<img src=x onerror=alert(1)>`;
      await createAsk(asker, { title: markup });

      expect(await readBoardTitles(helper)).toEqual([markup]);
    });
  });

  describe("the open limit", () => {
    it("lets a member have five open asks and refuses a sixth", async () => {
      for (let position = 0; position < ASK_LIMITS.openPerMember; position += 1) await createAsk(asker, { title: `Ask ${position}` });

      const response = await call(postCreate, asker, { title: "One more", category: ASK_CATEGORIES.other });

      expect(response.status).toBe(CONFLICT_STATUS);
      expect(await response.json()).toMatchObject({ code: ASK_ERROR_CODES.openLimit });
    });

    it("holds when requests arrive at the same moment", async () => {
      const responses = await Promise.all(
        Array.from({ length: ASK_LIMITS.openPerMember + 3 }, (_unused, position) => call(postCreate, asker, { title: `Ask ${position}`, category: ASK_CATEGORIES.other })),
      );

      expect(responses.filter(({ status }) => status === OK_STATUS)).toHaveLength(ASK_LIMITS.openPerMember);
      expect((await readOwn(asker)).openCount).toBe(ASK_LIMITS.openPerMember);
    });

    it("counts each member separately", async () => {
      for (let position = 0; position < ASK_LIMITS.openPerMember; position += 1) await createAsk(asker, { title: `Ask ${position}` });

      await createAsk(helper);

      expect((await readOwn(helper)).openCount).toBe(1);
    });

    it("frees a place when an ask closes", async () => {
      const askIds = [];
      for (let position = 0; position < ASK_LIMITS.openPerMember; position += 1) askIds.push(await createAsk(asker, { title: `Ask ${position}` }));

      await call(postClose, asker, { askId: askIds[0], outcome: ASK_OUTCOMES.noLongerNeeded });

      await createAsk(asker, { title: "Now there's room" });
    });

    it("frees a place when an ask expires", async () => {
      const askIds = [];
      for (let position = 0; position < ASK_LIMITS.openPerMember; position += 1) askIds.push(await createAsk(asker, { title: `Ask ${position}` }));
      await ageAsk(String(askIds[0]), ASK_LIMITS.lifetimeDays + 1);

      await createAsk(asker, { title: "Now there's room" });
    });
  });

  describe("the rate limit", () => {
    it("slows down a member posting too fast", async () => {
      const responses = [];
      for (let attempt = 0; attempt < ASK_MAXIMUM_PER_MINUTE[ASK_POSTING_KINDS.ask]; attempt += 1) {
        responses.push(await call(postCreate, asker, { title: `Ask ${attempt}`, category: ASK_CATEGORIES.other }));
      }
      const limited = await call(postCreate, asker, { title: "One too many", category: ASK_CATEGORIES.other });

      expect(limited.status).toBe(TOO_MANY_REQUESTS_STATUS);
      expect(await limited.json()).toMatchObject({ code: ASK_ERROR_CODES.tooFast });
    });

    it("leaves other members alone", async () => {
      for (let attempt = 0; attempt <= ASK_MAXIMUM_PER_MINUTE[ASK_POSTING_KINDS.ask]; attempt += 1) {
        await call(postCreate, asker, { title: `Ask ${attempt}`, category: ASK_CATEGORIES.other });
      }

      await createAsk(helper);
    });

    it("slows down a member offering too fast", async () => {
      const askId = await createAsk(asker);
      for (let attempt = 0; attempt < ASK_MAXIMUM_PER_MINUTE[ASK_POSTING_KINDS.offer]; attempt += 1) await offer(helper, askId);

      expect((await offer(helper, askId)).status).toBe(TOO_MANY_REQUESTS_STATUS);
    });
  });

  describe("the board", () => {
    it("lists open asks newest first", async () => {
      const older = await createAsk(asker, { title: "Older" });
      await ageAsk(older, 2);
      await createAsk(helper, { title: "Newer" });

      expect(await readBoardTitles(bystander)).toEqual(["Newer", "Older"]);
    });

    it("filters by category", async () => {
      await createAsk(asker, { title: "A hire", category: ASK_CATEGORIES.hire });
      await createAsk(asker, { title: "Some advice", category: ASK_CATEGORIES.advice });

      expect(await readBoardTitles(bystander, { category: ASK_CATEGORIES.advice })).toEqual(["Some advice"]);
    });

    it("pages through a long board without repeating an ask", async () => {
      const members = await Promise.all(Array.from({ length: 5 }, () => createSignedInMember(database)));
      const total = ASK_LIMITS.asksPerPage + 3;
      const rows = Array.from({ length: total }, (_unused, position) => ({
        authorId: members[position % members.length]?.userId ?? asker.userId,
        title: `Ask ${position}`,
        category: ASK_CATEGORIES.other,
        listedAt: new Date(Date.now() - position * 1000),
      }));
      await database.insert(ask).values(rows);

      const firstPage = await readBoard(bystander);
      const secondPage = await readBoard(bystander, { cursor: firstPage.nextCursor });

      expect(firstPage.asks).toHaveLength(ASK_LIMITS.asksPerPage);
      expect(secondPage.asks).toHaveLength(total - ASK_LIMITS.asksPerPage);
      expect(new Set([...firstPage.asks, ...secondPage.asks].map(({ id }) => id)).size).toBe(total);
      expect(secondPage.nextCursor).toBeNull();
    });

    it("counts offers for everyone without showing the notes", async () => {
      const askId = await createAsk(asker);
      await offer(helper, askId);

      const response = await call(postBoard, bystander);
      const text = await response.text();

      expect(askBoardPageSchema.parse(JSON.parse(text)).asks[0]?.offerCount).toBe(1);
      expect(text).not.toContain(NOTE);
    });

    it("hides an ask from a removed member even when an admin keeps their content", async () => {
      await createAsk(asker);

      await call(postRemoveMember, admin, { memberId: asker.userId, contentChoice: "keep" });

      expect(await readBoardTitles(bystander)).toEqual([]);
      expect(await database.select({ id: ask.id }).from(ask)).toHaveLength(1);
    });
  });

  describe("offering help", () => {
    describe("with messages on", () => {
      it("opens a conversation and sends the note", async () => {
        const askId = await createAsk(asker);

        const response = await offer(helper, askId);

        expect(offerResultSchema.parse(await response.json()).isSentAsMessage).toBe(true);
        const messages = await readMessageBodies();
        expect(messages).toHaveLength(1);
        expect(messages[0]?.senderId).toBe(helper.userId);
        expect(messages[0]?.body).toContain(CFO_ASK);
        expect(messages[0]?.body).toContain(NOTE);
      });

      it("continues the conversation they already have", async () => {
        const firstAsk = await createAsk(asker, { title: "First" });
        const secondAsk = await createAsk(asker, { title: "Second" });

        await offer(helper, firstAsk);
        await offer(helper, secondAsk);

        const pair = toConversationPair(asker.userId, helper.userId);
        const conversations = await database
          .select({ id: conversation.id })
          .from(conversation)
          .where(and(eq(conversation.memberLowId, pair.memberLowId), eq(conversation.memberHighId, pair.memberHighId)));
        const messages = await readMessageBodies();
        expect(conversations).toHaveLength(1);
        expect(messages.map(({ conversationId }) => conversationId)).toEqual([conversations[0]?.id, conversations[0]?.id]);
      });

      it("still keeps the note on the ask, in case messages goes off later", async () => {
        const askId = await createAsk(asker);
        await offer(helper, askId);

        await saveModuleState(database, messagesManifest, false);

        expect((await readOwn(asker)).asks[0]?.offers[0]?.note).toBe(NOTE);
      });

      it("sends one message when a member offers twice", async () => {
        const askId = await createAsk(asker);
        await offer(helper, askId);

        const again = offerResultSchema.parse(await (await offer(helper, askId, "A second note")).json());

        expect(again.wasAlreadyOffered).toBe(true);
        expect(await readMessageBodies()).toHaveLength(1);
        expect((await readOwn(asker)).asks[0]?.offers.map(({ note }) => note)).toEqual([NOTE]);
      });

      it("keeps the note on the ask when the message can't go out", async () => {
        const askId = await createAsk(asker);
        const startLimit = MESSAGING_MAXIMUM_PER_MINUTE[MESSAGING_KINDS.start];
        for (let attempt = 0; attempt <= startLimit; attempt += 1) await recordFailedAttempt(database, `messages-start|${helper.userId}`, startLimit);

        const result = offerResultSchema.parse(await (await offer(helper, askId)).json());

        expect(result.isSentAsMessage).toBe(false);
        expect((await readOwn(asker)).asks[0]?.offers[0]?.note).toBe(NOTE);
      });
    });

    describe("with messages off", () => {
      beforeEach(async () => {
        await saveModuleState(database, messagesManifest, false);
      });

      it("stores the note on the ask and shows it to the asker", async () => {
        const askId = await createAsk(asker);

        const result = offerResultSchema.parse(await (await offer(helper, askId)).json());

        expect(result.isSentAsMessage).toBe(false);
        expect(await readMessageBodies()).toHaveLength(0);
        expect(await database.select({ id: conversation.id }).from(conversation)).toHaveLength(0);
        expect((await readOwn(asker)).asks[0]?.offers[0]).toMatchObject({ note: NOTE, helper: { id: helper.userId, name: "Sam Helper" } });
      });

      it("shows the helper their own note on the board", async () => {
        const askId = await createAsk(asker);
        await offer(helper, askId);

        expect((await readBoard(helper)).asks[0]?.myOffer?.note).toBe(NOTE);
      });

      it("keeps the note out of everyone else's view, admins included", async () => {
        const askId = await createAsk(asker);
        await offer(helper, askId);

        const texts = await Promise.all([bystander, admin].map(async (member) => (await call(postBoard, member)).text()));

        for (const text of texts) expect(text).not.toContain(NOTE);
      });
    });

    it("refuses an offer on your own ask", async () => {
      const askId = await createAsk(asker);

      const response = await offer(asker, askId);

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect(await response.json()).toMatchObject({ code: ASK_ERROR_CODES.ownAsk });
    });

    it.each([
      ["an empty note", ""],
      ["a note over the limit", "x".repeat(ASK_LIMITS.noteLength + 1)],
    ])("refuses %s", async (_label, note) => {
      const askId = await createAsk(asker);

      expect((await offer(helper, askId, note)).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("answers 404 for an ask that doesn't exist", async () => {
      expect((await offer(helper, UNKNOWN_ID)).status).toBe(NOT_FOUND_STATUS);
    });

    it("refuses an offer on a closed ask", async () => {
      const askId = await createAsk(asker);
      await call(postClose, asker, { askId, outcome: ASK_OUTCOMES.solvedElsewhere });

      const response = await offer(helper, askId);

      expect(response.status).toBe(CONFLICT_STATUS);
      expect(await response.json()).toMatchObject({ code: ASK_ERROR_CODES.closed });
    });

    it("refuses an offer on an expired ask", async () => {
      const askId = await createAsk(asker);
      await ageAsk(askId, ASK_LIMITS.lifetimeDays + 1);

      expect((await offer(helper, askId)).status).toBe(CONFLICT_STATUS);
    });

    it("refuses an offer on the ask of a removed member", async () => {
      const askId = await createAsk(asker);
      await call(postRemoveMember, admin, { memberId: asker.userId, contentChoice: "keep" });

      expect((await offer(helper, askId)).status).toBe(NOT_FOUND_STATUS);
    });
  });

  describe("closing an ask", () => {
    it.each(Object.values(ASK_OUTCOMES))("takes it off the board with the outcome %s", async (outcome) => {
      const askId = await createAsk(asker);

      const response = await call(postClose, asker, { askId, outcome });

      expect(response.status).toBe(OK_STATUS);
      expect(await readBoardTitles(bystander)).toEqual([]);
      expect((await readOwn(asker)).asks[0]).toMatchObject({ state: ASK_STATES.closed, outcome });
    });

    it("keeps its offers for the asker to look back on", async () => {
      const askId = await createAsk(asker);
      await offer(helper, askId);

      await call(postClose, asker, { askId, outcome: ASK_OUTCOMES.solvedHere });

      expect((await readOwn(asker)).asks[0]?.offers).toHaveLength(1);
    });

    it("works on an expired ask", async () => {
      const askId = await createAsk(asker);
      await ageAsk(askId, ASK_LIMITS.lifetimeDays + 1);

      expect((await call(postClose, asker, { askId, outcome: ASK_OUTCOMES.noLongerNeeded })).status).toBe(OK_STATUS);
    });

    it("needs a known outcome", async () => {
      const askId = await createAsk(asker);

      expect((await call(postClose, asker, { askId, outcome: "abandoned" })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses a member who didn't ask", async () => {
      const askId = await createAsk(asker);

      expect((await call(postClose, helper, { askId, outcome: ASK_OUTCOMES.solvedHere })).status).toBe(NOT_FOUND_STATUS);
      expect(await readBoardTitles(bystander)).toEqual([CFO_ASK]);
    });

    it("refuses to close twice, and keeps the first outcome", async () => {
      const askId = await createAsk(asker);
      await call(postClose, asker, { askId, outcome: ASK_OUTCOMES.solvedHere });

      const again = await call(postClose, asker, { askId, outcome: ASK_OUTCOMES.noLongerNeeded });

      expect(again.status).toBe(CONFLICT_STATUS);
      expect((await readOwn(asker)).asks[0]?.outcome).toBe(ASK_OUTCOMES.solvedHere);
    });
  });

  describe("expiry", () => {
    it("takes an ask off the board after 30 days, with nothing running in the background", async () => {
      const askId = await createAsk(asker);

      await ageAsk(askId, ASK_LIMITS.lifetimeDays - 1);
      expect(await readBoardTitles(bystander)).toEqual([CFO_ASK]);

      await ageAsk(askId, ASK_LIMITS.lifetimeDays + 1);
      expect(await readBoardTitles(bystander)).toEqual([]);
    });

    it("shows the asker an expired ask, ready to renew", async () => {
      const askId = await createAsk(asker);
      await ageAsk(askId, ASK_LIMITS.lifetimeDays + 1);

      expect((await readOwn(asker)).asks[0]).toMatchObject({ state: ASK_STATES.expired, canRenew: true });
    });

    it("doesn't count an expired ask as open", async () => {
      const askId = await createAsk(asker);
      await ageAsk(askId, ASK_LIMITS.lifetimeDays + 1);

      expect((await readOwn(asker)).openCount).toBe(0);
    });
  });

  describe("renewing", () => {
    it("puts an expired ask back on the board at the top", async () => {
      await createAsk(helper, { title: "Someone else's" });
      const askId = await createAsk(asker);
      await ageAsk(askId, ASK_LIMITS.lifetimeDays + 1);

      expect((await call(postRenew, asker, { askId })).status).toBe(OK_STATUS);

      expect(await readBoardTitles(bystander)).toEqual([CFO_ASK, "Someone else's"]);
    });

    it("keeps the offers it already had", async () => {
      const askId = await createAsk(asker);
      await offer(helper, askId);
      await ageAsk(askId, ASK_LIMITS.lifetimeDays + 1);

      await call(postRenew, asker, { askId });

      expect((await readBoard(bystander)).asks[0]?.offerCount).toBe(1);
    });

    it("works in an ask's last days", async () => {
      const askId = await createAsk(asker);
      await ageAsk(askId, ASK_LIMITS.lifetimeDays - 2);

      expect((await call(postRenew, asker, { askId })).status).toBe(OK_STATUS);
    });

    it("refuses a fresh ask, so nobody can bump theirs to the top every day", async () => {
      const askId = await createAsk(asker);
      await ageAsk(askId, 1);

      const response = await call(postRenew, asker, { askId });

      expect(response.status).toBe(CONFLICT_STATUS);
      expect(await response.json()).toMatchObject({ code: ASK_ERROR_CODES.tooEarlyToRenew });
    });

    it("refuses an expired ask when it would make a sixth open one", async () => {
      const expiredId = await createAsk(asker, { title: "Expired" });
      await ageAsk(expiredId, ASK_LIMITS.lifetimeDays + 1);
      for (let position = 0; position < ASK_LIMITS.openPerMember; position += 1) await createAsk(asker, { title: `Ask ${position}` });

      const response = await call(postRenew, asker, { askId: expiredId });

      expect(response.status).toBe(CONFLICT_STATUS);
      expect(await response.json()).toMatchObject({ code: ASK_ERROR_CODES.openLimit });
    });

    it("renews an open ask when already at the limit, because the count doesn't change", async () => {
      const askIds = [];
      for (let position = 0; position < ASK_LIMITS.openPerMember; position += 1) askIds.push(await createAsk(asker, { title: `Ask ${position}` }));
      await ageAsk(String(askIds[0]), ASK_LIMITS.lifetimeDays - 2);

      expect((await call(postRenew, asker, { askId: askIds[0] })).status).toBe(OK_STATUS);
    });

    it("refuses a closed ask", async () => {
      const askId = await createAsk(asker);
      await call(postClose, asker, { askId, outcome: ASK_OUTCOMES.solvedHere });

      expect((await call(postRenew, asker, { askId })).status).toBe(CONFLICT_STATUS);
    });

    it("refuses a member who didn't ask", async () => {
      const askId = await createAsk(asker);
      await ageAsk(askId, ASK_LIMITS.lifetimeDays + 1);

      expect((await call(postRenew, helper, { askId })).status).toBe(NOT_FOUND_STATUS);
    });
  });

  describe("the new offers badge", () => {
    it("counts new offers on your open asks", async () => {
      const askId = await createAsk(asker);
      await offer(helper, askId);
      await offer(bystander, askId);

      expect(await readNewOffers(asker)).toBe(2);
      expect(await readNewOffers(helper)).toBe(0);
    });

    it("clears once you've seen them, and counts the next one", async () => {
      const askId = await createAsk(asker);
      await offer(helper, askId);

      await call(postSeen, asker);
      expect(await readNewOffers(asker)).toBe(0);

      await offer(bystander, askId);
      expect(await readNewOffers(asker)).toBe(1);
    });

    it("marks an offer as new only until it's seen", async () => {
      const askId = await createAsk(asker);
      await offer(helper, askId);
      expect((await readOwn(asker)).asks[0]?.offers[0]?.isNew).toBe(true);

      await call(postSeen, asker);

      expect((await readOwn(asker)).asks[0]?.offers[0]?.isNew).toBe(false);
    });

    it("doesn't let one member clear another's badge", async () => {
      const askId = await createAsk(asker);
      await offer(helper, askId);

      await call(postSeen, bystander);

      expect(await readNewOffers(asker)).toBe(1);
    });

    it("stops counting when the ask closes or expires", async () => {
      const closing = await createAsk(asker, { title: "Closing" });
      const expiring = await createAsk(asker, { title: "Expiring" });
      await offer(helper, closing);
      await offer(helper, expiring);

      await call(postClose, asker, { askId: closing, outcome: ASK_OUTCOMES.solvedHere });
      await ageAsk(expiring, ASK_LIMITS.lifetimeDays + 1);

      expect(await readNewOffers(asker)).toBe(0);
    });

    it("reaches the shell only while the module is on", async () => {
      const askId = await createAsk(asker);
      await offer(helper, askId);

      expect(await readModuleBadges(database, asker.userId, await readEnabledIds(database))).toMatchObject({ [asksManifest.id]: 1 });

      await saveModuleState(database, asksManifest, false);

      expect(await readModuleBadges(database, asker.userId, await readEnabledIds(database))).not.toHaveProperty(asksManifest.id);
    });
  });

  describe("blocks", () => {
    describe.each([
      { direction: "the asker blocks the viewer", blockerIsAsker: true },
      { direction: "the viewer blocks the asker", blockerIsAsker: false },
    ])("when $direction", ({ blockerIsAsker }) => {
      function placeBlock() {
        return blockerIsAsker ? block(asker, helper) : block(helper, asker);
      }

      it("hides the ask from the board", async () => {
        await createAsk(asker);

        await placeBlock();

        expect(await readBoardTitles(helper)).toEqual([]);
        expect(await readBoardTitles(bystander)).toEqual([CFO_ASK]);
      });

      it("hides the viewer's ask from the asker too", async () => {
        await createAsk(helper, { title: "Helper's own ask" });

        await placeBlock();

        expect(await readBoardTitles(asker)).toEqual([]);
      });

      it("refuses an offer as if the ask weren't there", async () => {
        const askId = await createAsk(asker);
        await placeBlock();

        const response = await offer(helper, askId);

        expect(response.status).toBe(NOT_FOUND_STATUS);
        expect(await database.select({ id: askOffer.id }).from(askOffer)).toHaveLength(0);
        expect(await readMessageBodies()).toHaveLength(0);
      });

      it("refuses a report as if the ask weren't there", async () => {
        const askId = await createAsk(asker);
        await placeBlock();

        expect((await call(postReport, helper, { askId })).status).toBe(NOT_FOUND_STATUS);
      });

      it("removes the note the viewer already sent, from the list and the badge", async () => {
        const askId = await createAsk(asker);
        await saveModuleState(database, messagesManifest, false);
        await offer(helper, askId);

        await placeBlock();

        expect((await readOwn(asker)).asks[0]?.offers).toEqual([]);
        expect(await readNewOffers(asker)).toBe(0);
        expect((await readBoard(bystander)).asks[0]?.offerCount).toBe(0);
      });

      it("doesn't bring the note back after an unblock", async () => {
        const askId = await createAsk(asker);
        await offer(helper, askId);
        await placeBlock();

        await (blockerIsAsker ? block(asker, helper, false) : block(helper, asker, false));

        expect((await readOwn(asker)).asks[0]?.offers).toEqual([]);
        expect(await readBoardTitles(helper)).toEqual([CFO_ASK]);
      });

      it("removes the note even with the module off", async () => {
        const askId = await createAsk(asker);
        await offer(helper, askId);
        await saveModuleState(database, asksManifest, false);

        await placeBlock();

        expect(await database.select({ id: askOffer.id }).from(askOffer).where(eq(askOffer.askId, askId))).toHaveLength(0);
      });
    });

    it("hides a blocked member's offer from the count a third member sees", async () => {
      const askId = await createAsk(asker);
      await offer(helper, askId);

      await block(bystander, helper);

      expect((await readBoard(bystander)).asks[0]?.offerCount).toBe(0);
      expect((await readBoard(asker)).asks[0]?.offerCount).toBe(1);
    });

    it("leaves other members' offers alone", async () => {
      const askId = await createAsk(asker);
      await offer(helper, askId);
      await offer(bystander, askId);

      await block(asker, helper);

      expect((await readOwn(asker)).asks[0]?.offers.map(({ helper: { id } }) => id)).toEqual([bystander.userId]);
    });

    it("leaves offers between the pair on other people's asks alone", async () => {
      const askId = await createAsk(bystander);
      await offer(helper, askId);

      await block(asker, helper);

      expect((await readOwn(bystander)).asks[0]?.offers).toHaveLength(1);
    });
  });

  describe("removing a member", () => {
    it("deletes their asks and offers when an admin deletes their content", async () => {
      const ownAskId = await createAsk(helper, { title: "Helper's ask" });
      await offer(bystander, ownAskId);
      const othersAskId = await createAsk(asker);
      await offer(helper, othersAskId);

      await call(postRemoveMember, admin, { memberId: helper.userId, contentChoice: "delete" });

      expect(await database.select({ id: ask.id }).from(ask).where(eq(ask.authorId, helper.userId))).toHaveLength(0);
      expect(await database.select({ id: askOffer.id }).from(askOffer).where(eq(askOffer.helperId, helper.userId))).toHaveLength(0);
      expect(await readBoardTitles(bystander)).toEqual([CFO_ASK]);
    });

    it("does the same with the module off", async () => {
      await createAsk(helper);
      await saveModuleState(database, asksManifest, false);

      await call(postRemoveMember, admin, { memberId: helper.userId, contentChoice: "delete" });

      expect(await database.select({ id: ask.id }).from(ask)).toHaveLength(0);
    });

    it("leaves a copy of each deleted ask in the audit log", async () => {
      await createAsk(helper, { title: "Helper's ask", detail: "Some detail." });

      await call(postRemoveMember, admin, { memberId: helper.userId, contentChoice: "delete" });

      const entries = await database.select().from(adminAuditEntry).where(eq(adminAuditEntry.action, AUDIT_ACTIONS.askRemoved));
      expect(entries).toEqual([expect.objectContaining({ actorId: admin.userId, targetMemberId: helper.userId, detail: "Helper's ask\n\nSome detail." })]);
    });

    it("keeps their asks and brings them back on unban when an admin keeps their content", async () => {
      await createAsk(helper);

      await call(postRemoveMember, admin, { memberId: helper.userId, contentChoice: "keep" });

      expect(await database.select({ id: ask.id }).from(ask)).toHaveLength(1);
      await database.update(user).set({ banned: false }).where(eq(user.id, helper.userId));
      expect(await readBoardTitles(bystander)).toEqual([CFO_ASK]);
    });

    it("hides their offer while they're removed", async () => {
      const askId = await createAsk(asker);
      await offer(helper, askId);

      await call(postRemoveMember, admin, { memberId: helper.userId, contentChoice: "keep" });

      expect((await readOwn(asker)).asks[0]?.offers).toEqual([]);
      expect(await readNewOffers(asker)).toBe(0);
    });
  });

  describe("an admin removing an ask", () => {
    it("takes it and its offers away", async () => {
      const askId = await createAsk(asker);
      await offer(helper, askId);

      expect((await call(postRemove, admin, { askId })).status).toBe(OK_STATUS);

      expect(await readBoardTitles(bystander)).toEqual([]);
      expect(await database.select({ id: askOffer.id }).from(askOffer)).toHaveLength(0);
    });

    it("writes who did it and a copy to the audit log", async () => {
      const askId = await createAsk(asker, { detail: "The detail." });

      await call(postRemove, admin, { askId });

      const entries = await database.select().from(adminAuditEntry).where(eq(adminAuditEntry.action, AUDIT_ACTIONS.askRemoved));
      expect(entries).toEqual([expect.objectContaining({ actorId: admin.userId, targetMemberId: asker.userId, detail: `${CFO_ASK}\n\nThe detail.` })]);
    });

    it("refuses a member who isn't an admin", async () => {
      const askId = await createAsk(asker);

      expect((await call(postRemove, helper, { askId })).status).toBe(FORBIDDEN_STATUS);
      expect((await call(postRemove, asker, { askId })).status).toBe(FORBIDDEN_STATUS);
      expect(await readBoardTitles(bystander)).toEqual([CFO_ASK]);
    });

    it("answers 404 when it's already gone", async () => {
      expect((await call(postRemove, admin, { askId: UNKNOWN_ID })).status).toBe(NOT_FOUND_STATUS);
    });
  });

  describe("reporting", () => {
    async function readOpenReports() {
      return reportPageSchema.parse(await (await call(postReportList, admin, { filter: REPORT_FILTERS.open })).json()).reports;
    }

    it("saves a copy for the admins", async () => {
      const askId = await createAsk(asker, { detail: "The detail." });

      const response = await call(postReport, helper, { askId });

      expect(response.status).toBe(OK_STATUS);
      expect(await readOpenReports()).toEqual([
        expect.objectContaining({ targetType: REPORT_TARGETS.ask, body: `${CFO_ASK}\n\nThe detail.`, reportedMemberName: "Maya Asker", reporterName: "Sam Helper", isContentGone: false }),
      ]);
    });

    it("refuses a report on your own ask", async () => {
      const askId = await createAsk(asker);

      expect((await call(postReport, asker, { askId })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("tells a member they already reported it", async () => {
      const askId = await createAsk(asker);
      await call(postReport, helper, { askId });

      const again = await call(postReport, helper, { askId });

      expect(await again.json()).toMatchObject({ message: expect.stringContaining("already reported") });
      expect(await readOpenReports()).toHaveLength(1);
    });

    it("lets an admin delete a reported ask, closing every report on it", async () => {
      const askId = await createAsk(asker);
      await call(postReport, helper, { askId });
      await call(postReport, bystander, { askId });
      const [report] = await readOpenReports();

      const response = await call(postDeleteReported, admin, { reportId: report?.id, targetType: REPORT_TARGETS.ask });

      expect(response.status).toBe(OK_STATUS);
      expect(await readBoardTitles(bystander)).toEqual([]);
      expect(await readOpenReports()).toEqual([]);
      const actions = (await database.select({ action: adminAuditEntry.action }).from(adminAuditEntry)).map(({ action }) => action);
      expect(actions).toEqual(expect.arrayContaining([AUDIT_ACTIONS.askRemoved, AUDIT_ACTIONS.reportedContentDeleted]));
    });

    it("flags a report whose ask is already gone", async () => {
      const askId = await createAsk(asker);
      await call(postReport, helper, { askId });

      await call(postRemove, admin, { askId });

      expect((await readOpenReports())[0]?.isContentGone).toBe(true);
    });

    it("explains when an admin deletes a reported ask that's already gone", async () => {
      const askId = await createAsk(asker);
      await call(postReport, helper, { askId });
      const [report] = await readOpenReports();
      await call(postRemove, admin, { askId });

      const response = await call(postDeleteReported, admin, { reportId: report?.id, targetType: REPORT_TARGETS.ask });

      expect(response.status).toBe(CONFLICT_STATUS);
    });

    describe("with the module off", () => {
      let reportId: string | undefined;

      beforeEach(async () => {
        const askId = await createAsk(asker);
        await call(postReport, helper, { askId });
        reportId = (await readOpenReports())[0]?.id;
        await saveModuleState(database, asksManifest, false);
      });

      it("stays visible to admins", async () => {
        expect((await readOpenReports()).map(({ targetType }) => targetType)).toEqual([REPORT_TARGETS.ask]);
      });

      it("can be dismissed", async () => {
        expect((await call(postDismissReport, admin, { reportId, targetType: REPORT_TARGETS.ask })).status).toBe(OK_STATUS);
        expect(await readOpenReports()).toEqual([]);
      });

      it("can have its ask deleted, with the audit entry", async () => {
        expect((await call(postDeleteReported, admin, { reportId, targetType: REPORT_TARGETS.ask })).status).toBe(OK_STATUS);

        expect(await database.select({ id: ask.id }).from(ask)).toHaveLength(0);
        const actions = (await database.select({ action: adminAuditEntry.action }).from(adminAuditEntry)).map(({ action }) => action);
        expect(actions).toContain(AUDIT_ACTIONS.askRemoved);
      });
    });
  });

  describe("turning the module off and on", () => {
    it("answers 404 and comes back with everything intact", async () => {
      const askId = await createAsk(asker, { detail: "The detail." });
      await saveModuleState(database, messagesManifest, false);
      await offer(helper, askId);
      const closedId = await createAsk(asker, { title: "Closed one" });
      await call(postClose, asker, { askId: closedId, outcome: ASK_OUTCOMES.solvedHere });

      await saveModuleState(database, asksManifest, false);
      expect((await call(postBoard, asker)).status).toBe(NOT_FOUND_STATUS);
      expect((await call(postCreate, asker, { title: "Nope", category: ASK_CATEGORIES.other })).status).toBe(NOT_FOUND_STATUS);

      await saveModuleState(database, asksManifest, true);

      expect(await readBoardTitles(bystander)).toEqual([CFO_ASK]);
      const own = await readOwn(asker);
      expect(own.asks.find(({ id }) => id === askId)?.offers[0]?.note).toBe(NOTE);
      expect(own.asks.find(({ id }) => id === closedId)?.state).toBe(ASK_STATES.closed);
      expect(await readNewOffers(asker)).toBe(1);
    });

    it("doesn't lose time: an ask can expire while the module is off", async () => {
      const askId = await createAsk(asker);
      await saveModuleState(database, asksManifest, false);
      await ageAsk(askId, ASK_LIMITS.lifetimeDays + 1);

      await saveModuleState(database, asksManifest, true);

      expect(await readBoardTitles(bystander)).toEqual([]);
    });
  });
});
