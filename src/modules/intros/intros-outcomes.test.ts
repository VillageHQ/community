import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as postCounts } from "@/app/api/intros/counts/route";
import { POST as postDetail } from "@/app/api/intros/detail/route";
import { POST as postOutcome } from "@/app/api/intros/outcome/route";
import { POST as postBoard } from "@/app/api/intros/route";
import { POST as postTransition } from "@/app/api/intros/transition/route";
import { POST as postBlock } from "@/app/api/members/block/route";
import { readCommunityHealth } from "@/modules/admin/reads-health";
import {
  INTRO_ACTIONS,
  INTRO_OUTCOMES,
  INTRO_STATES,
  OUTCOME_PROMPT_AFTER_DAYS,
  OUTCOME_PROMPT_WINDOW_DAYS,
  introBoardSchema,
  introCountsSchema,
  introSchema,
} from "@/modules/intros/contract";
import { readIntroBadgeCount, readIntroCommunityCounts, readIntroCounts } from "@/modules/intros/reads";
import { introRequest } from "@/modules/intros/schema";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { joinMemberToGroup } from "@/test/intros";
import { createSignedInMember } from "@/test/signed-in-member";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const MILLISECONDS_PER_DAY = 86_400_000;
const NOTE = "A private note about freight pricing.";
const TARGET_NAME = "Clara Bergström";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;

function call(handler: Handler, member: Member, body: unknown) {
  return handler(
    new Request(`${APP_URL}/api/intros`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
      body: JSON.stringify(body),
    }),
  );
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * MILLISECONDS_PER_DAY);
}

describe("asking if an intro helped", () => {
  const database = createTestDatabase();
  let requester: Member;
  let connector: Member;
  let bystander: Member;

  async function seedIntro(overrides: Partial<typeof introRequest.$inferInsert> = {}) {
    const [intro] = await database
      .insert(introRequest)
      .values({
        requesterId: requester.userId,
        introducerId: connector.userId,
        targetLinkedinSlug: `target-${crypto.randomUUID()}`,
        targetName: TARGET_NAME,
        introducerName: "Jonas Lindqvist",
        introducerLinkedinSlug: "jonas",
        reason: "Worked together",
        note: NOTE,
        expiresAt: new Date(Date.now() + MILLISECONDS_PER_DAY),
        ...overrides,
      })
      .returning({ id: introRequest.id });
    if (!intro) throw new Error("Expected an intro.");
    return intro.id;
  }

  function seedIntroducedDaysAgo(days: number, overrides: Partial<typeof introRequest.$inferInsert> = {}) {
    return seedIntro({ state: INTRO_STATES.completed, closedAt: daysAgo(days), ...overrides });
  }

  function answer(member: Member, introId: string, outcome: string) {
    return call(postOutcome, member, { introId, outcome });
  }

  async function readDetail(member: Member, introId: string) {
    return introSchema.parse(await (await call(postDetail, member, { introId })).json());
  }

  async function readOutcomesDue(member: Member) {
    return introCountsSchema.parse(await (await call(postCounts, member, {})).json()).outcomesDue;
  }

  beforeEach(async () => {
    await clearDatabase(database);
    requester = await createSignedInMember(database);
    connector = await createSignedInMember(database);
    bystander = await createSignedInMember(database);
    await joinMemberToGroup(database, requester.userId, "amara");
    await joinMemberToGroup(database, connector.userId, "jonas");
  });

  afterAll(async () => {
    await database.$client.end();
  });

  describe("when it asks", () => {
    it("stays quiet for the first week", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS - 1);

      expect((await readDetail(requester, introId)).isOutcomeDue).toBe(false);
      expect(await readOutcomesDue(requester)).toBe(0);
    });

    it("asks after about a week, at read time", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);

      expect((await readDetail(requester, introId)).isOutcomeDue).toBe(true);
      expect(await readOutcomesDue(requester)).toBe(1);
    });

    it("adds to the nav badge", async () => {
      await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);

      expect(readIntroBadgeCount(await readIntroCounts(database, requester.userId))).toBe(1);
    });

    it("gives up eventually, so it can't nag forever", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_WINDOW_DAYS + 1);

      expect((await readDetail(requester, introId)).isOutcomeDue).toBe(false);
      expect(await readOutcomesDue(requester)).toBe(0);
    });

    it("asks about an intro finished before this feature existed", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS, { acceptedAt: daysAgo(10) });

      expect((await readDetail(requester, introId)).isOutcomeDue).toBe(true);
    });

    it("agrees between the badge and the card at every age", async () => {
      for (const days of [OUTCOME_PROMPT_AFTER_DAYS - 1, OUTCOME_PROMPT_AFTER_DAYS + 1, OUTCOME_PROMPT_WINDOW_DAYS - 1, OUTCOME_PROMPT_WINDOW_DAYS + 1]) {
        await seedIntroducedDaysAgo(days);
      }

      const { yourAsks, counts } = introBoardSchema.parse(await (await call(postBoard, requester, {})).json());

      expect(yourAsks.filter(({ isOutcomeDue }) => isOutcomeDue)).toHaveLength(counts.outcomesDue);
      expect(counts.outcomesDue).toBe(2);
    });

    it.each([INTRO_STATES.declined, INTRO_STATES.withdrawn, INTRO_STATES.expired])("never asks about a %s ask", async (state) => {
      const introId = await seedIntro({ state, closedAt: daysAgo(OUTCOME_PROMPT_AFTER_DAYS) });

      expect((await readDetail(requester, introId)).isOutcomeDue).toBe(false);
      expect((await answer(requester, introId, INTRO_OUTCOMES.helped)).status).toBe(CONFLICT_STATUS);
    });

    it("never asks the connector", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);

      expect((await readDetail(connector, introId)).isOutcomeDue).toBe(false);
      expect(await readOutcomesDue(connector)).toBe(0);
    });
  });

  describe("an answer", () => {
    it.each(Object.values(INTRO_OUTCOMES))("saves %s", async (outcome) => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);

      const response = await answer(requester, introId, outcome);

      expect(response.status).toBe(OK_STATUS);
      expect(introSchema.parse(await response.json()).outcome).toBe(outcome);
    });

    it("ends the prompt after a yes or a no", async () => {
      const helped = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);
      const notHelped = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);

      await answer(requester, helped, INTRO_OUTCOMES.helped);
      await answer(requester, notHelped, INTRO_OUTCOMES.notHelped);

      expect(await readOutcomesDue(requester)).toBe(0);
    });

    it("pauses the prompt for a week after not yet", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);

      await answer(requester, introId, INTRO_OUTCOMES.notYet);
      expect(await readOutcomesDue(requester)).toBe(0);

      await database.update(introRequest).set({ outcomeAnsweredAt: daysAgo(OUTCOME_PROMPT_AFTER_DAYS) }).where(eq(introRequest.id, introId));
      expect(await readOutcomesDue(requester)).toBe(1);
    });

    it("lets a later answer replace not yet", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS, { outcome: INTRO_OUTCOMES.notYet, outcomeAnsweredAt: daysAgo(OUTCOME_PROMPT_AFTER_DAYS) });

      await answer(requester, introId, INTRO_OUTCOMES.helped);

      expect((await readDetail(requester, introId)).outcome).toBe(INTRO_OUTCOMES.helped);
    });

    it("refuses to change a final answer", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);
      await answer(requester, introId, INTRO_OUTCOMES.helped);

      expect((await answer(requester, introId, INTRO_OUTCOMES.notHelped)).status).toBe(CONFLICT_STATUS);
    });

    it("accepts the same answer twice, for a double click", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);
      await answer(requester, introId, INTRO_OUTCOMES.helped);

      expect((await answer(requester, introId, INTRO_OUTCOMES.helped)).status).toBe(OK_STATUS);
    });

    it("refuses an answer before it's asked", async () => {
      const introId = await seedIntroducedDaysAgo(1);

      expect((await answer(requester, introId, INTRO_OUTCOMES.helped)).status).toBe(CONFLICT_STATUS);
    });

    it("refuses an unknown answer", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);

      expect((await answer(requester, introId, "maybe")).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("answers the connector and a bystander like an unknown ask", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);

      expect((await answer(connector, introId, INTRO_OUTCOMES.helped)).status).toBe(NOT_FOUND_STATUS);
      expect((await answer(bystander, introId, INTRO_OUTCOMES.helped)).status).toBe(NOT_FOUND_STATUS);
    });

    it("keeps the answer from the connector", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);
      await answer(requester, introId, INTRO_OUTCOMES.notHelped);

      expect((await readDetail(connector, introId)).outcome).toBeNull();
    });

    it("still works after the connector blocks the requester", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);
      await call(postBlock, connector, { memberId: requester.userId, isBlocked: true });

      expect((await answer(requester, introId, INTRO_OUTCOMES.helped)).status).toBe(OK_STATUS);
    });
  });

  describe("the totals admins see", () => {
    it("counts asked, introduced, declined and helped", async () => {
      await seedIntro();
      await seedIntro({ state: INTRO_STATES.withdrawn, closedAt: new Date() });
      await seedIntro({ state: INTRO_STATES.declined, closedAt: new Date() });
      await seedIntro({ state: INTRO_STATES.targetDeclined, closedAt: new Date() });
      await seedIntroducedDaysAgo(1);
      await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS, { outcome: INTRO_OUTCOMES.helped, outcomeAnsweredAt: new Date() });
      await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS, { outcome: INTRO_OUTCOMES.notHelped, outcomeAnsweredAt: new Date() });

      expect(await readIntroCommunityCounts(database)).toEqual({ asked: 7, introduced: 3, declined: 2, helped: 1 });
    });

    it("appear on the health read with no private detail", async () => {
      await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS, { outcome: INTRO_OUTCOMES.helped, outcomeAnsweredAt: new Date() });

      const { intros } = await readCommunityHealth(database);
      const health = JSON.stringify(intros);

      expect(intros).toEqual({ asked: 1, introduced: 1, declined: 0, helped: 1 });
      expect(health).not.toContain(NOTE);
      expect(health).not.toContain(TARGET_NAME);
      expect(health).not.toContain(requester.userId);
    });
  });

  describe("an old connector action on a finished intro", () => {
    it("can't reopen it", async () => {
      const introId = await seedIntroducedDaysAgo(OUTCOME_PROMPT_AFTER_DAYS);

      expect((await call(postTransition, connector, { introId, action: INTRO_ACTIONS.complete })).status).toBe(OK_STATUS);
      expect((await call(postTransition, connector, { introId, action: INTRO_ACTIONS.accept })).status).toBe(CONFLICT_STATUS);
    });
  });
});
