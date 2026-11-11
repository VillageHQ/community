import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postConsentAnswer } from "@/app/api/intros/consent/answer/route";
import { POST as postLinkAnswer } from "@/app/api/intros/link/answer/route";
import { INTRO_LINK_PURPOSES, INTRO_OUTCOMES, INTRO_STATES } from "@/modules/intros/contract";
import { issueAnswerLink } from "@/modules/intros/answer-links";
import { introsManifest } from "@/modules/intros/manifest";
import { CLOSED_REASONS, LINK_VIEWS, readIntroLinkView } from "@/modules/intros/reads-links";
import { introConsentLink, introOptOut, introRequest } from "@/modules/intros/schema";
import { user } from "@/platform/database/auth-schema";
import { emailOutbox } from "@/platform/email/schema";
import { saveModuleState } from "@/platform/modules/enablement";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { seedMember } from "@/test/members";

const APP_URL = "http://localhost:3000";
const DAY_MS = 24 * 60 * 60_000;
const TARGET_EMAIL = "rosa@halcyon.example";
const NOTE = "I'm Sam, Co-founder & CEO at Tallyhealth.";

type SentBody = { to: string[]; subject: string; text: string };

// Founderhall's links that answer without signing in: the connector's (from the ask email) and the asker's outcome
// link, and the person's "stop intro asks" page.
describe("intro links from emails", () => {
  const database = createTestDatabase();
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;

  async function readEmail(memberId: string) {
    const [row] = await database.select({ email: user.email }).from(user).where(eq(user.id, memberId));
    return row?.email ?? "";
  }

  async function seedIntro(overrides: Partial<typeof introRequest.$inferInsert> = {}) {
    const sam = await seedMember(database, { name: "Sam Lee" });
    const marcus = await seedMember(database, { name: "Marcus Webb" });
    const [intro] = await database
      .insert(introRequest)
      .values({
        requesterId: sam,
        introducerId: marcus,
        targetLinkedinSlug: `~["rosa lindqvist","halcyon health"]-${crypto.randomUUID()}`,
        targetName: "Rosa Lindqvist",
        targetHeadline: "CTO at Halcyon Health",
        introducerName: "Marcus Webb",
        reason: "Asked from a profile",
        note: NOTE,
        isNamedTarget: true,
        expiresAt: new Date(Date.now() + 7 * DAY_MS),
        ...overrides,
      })
      .returning();
    if (!intro) throw new Error("Expected an intro.");
    return { sam, marcus, intro };
  }

  function answerByLink(body: Record<string, unknown>) {
    return postLinkAnswer(new Request(`${APP_URL}/api/intros/link/answer`, { method: "POST", headers: { "Content-Type": "application/json", Origin: APP_URL }, body: JSON.stringify(body) }));
  }

  async function readRow(id: string) {
    const [row] = await database.select().from(introRequest).where(eq(introRequest.id, id));
    if (!row) throw new Error("Expected the intro.");
    return row;
  }

  const sent = () => resend.state.emails.map(({ body }) => body as SentBody);

  function viewOf(token: string) {
    return readIntroLinkView({ database, environment: process.env, headers: new Headers(), readViewerId: async () => null }, token);
  }

  beforeAll(async () => {
    resend = await startFakeResendServer();
  });

  afterAll(async () => {
    await resend.stop();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    resend.reset();
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("BETTER_AUTH_SECRET", "a-test-auth-secret-with-at-least-32-characters");
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.com>");
    vi.stubEnv("RESEND_API_URL", resend.url);
    vi.stubEnv("RESEND_REPLY_DOMAIN", "");
    await saveModuleState(database, introsManifest, true);
  });

  describe("the connector's link", () => {
    it("shows the question without changing anything", async () => {
      const { intro } = await seedIntro();
      const token = await issueAnswerLink(database, intro.id, INTRO_LINK_PURPOSES.connector);

      const view = await viewOf(token);

      expect(view).toMatchObject({ view: LINK_VIEWS.connector, askerName: "Sam Lee", connectorName: "Marcus Webb", targetName: "Rosa Lindqvist", note: NOTE, canEmail: true });
      expect((await readRow(intro.id)).state).toBe(INTRO_STATES.requested);
    });

    it("asks for the person's email with a yes, as Founderhall does", async () => {
      const { intro } = await seedIntro();
      const token = await issueAnswerLink(database, intro.id, INTRO_LINK_PURPOSES.connector);

      const response = await answerByLink({ purpose: "connector", token, choice: "yes", targetEmail: null, note: null });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ message: "Add Rosa’s email, so we can ask them." });
      expect((await readRow(intro.id)).state).toBe(INTRO_STATES.requested);
    });

    it("refuses the asker's own address", async () => {
      const { intro, sam } = await seedIntro();
      const token = await issueAnswerLink(database, intro.id, INTRO_LINK_PURPOSES.connector);

      const response = await answerByLink({ purpose: "connector", token, choice: "yes", targetEmail: await readEmail(sam), note: null });

      expect(await response.json()).toMatchObject({ message: "That is not the target’s address." });
    });

    it("says yes, keeps the edited note, and asks the person by email in one step", async () => {
      const { intro } = await seedIntro();
      const token = await issueAnswerLink(database, intro.id, INTRO_LINK_PURPOSES.connector);

      const response = await answerByLink({ purpose: "connector", token, choice: "yes", targetEmail: TARGET_EMAIL, note: `${NOTE}\r\nEdited by Marcus.` });

      expect(await response.json()).toEqual({ result: "asked_target" });
      const row = await readRow(intro.id);
      expect(row.state).toBe(INTRO_STATES.askingTarget);
      expect(row.note).toBe(`${NOTE}\nEdited by Marcus.`);
      const [toRosa] = sent().filter(({ to }) => to.includes(TARGET_EMAIL));
      expect(toRosa?.subject).toBe("Marcus Webb would like to introduce you to Sam Lee");
      expect(toRosa?.text).toContain("Edited by Marcus.");
      expect(toRosa?.text).toMatch(/\/i\/[\w-]+\?a=yes/);
      expect(toRosa?.text).toMatch(/\/intro\/optout\/[\w-]+/);
    });

    it("says no without a reason reaching the asker, and then shows Nothing to do", async () => {
      const { intro } = await seedIntro();
      const token = await issueAnswerLink(database, intro.id, INTRO_LINK_PURPOSES.connector);

      expect(await (await answerByLink({ purpose: "connector", token, choice: "dont_know", targetEmail: null, note: null, reason: "Private" })).json()).toEqual({ result: "declined" });

      const row = await readRow(intro.id);
      expect(row).toMatchObject({ state: INTRO_STATES.declined, declineKind: "do_not_know_them", declineReason: "Private" });
      expect(await viewOf(token)).toMatchObject({ view: LINK_VIEWS.closed, reason: CLOSED_REASONS.answered });
      expect((await answerByLink({ purpose: "connector", token, choice: "yes", targetEmail: TARGET_EMAIL, note: null })).status).toBe(410);
    });

    it("says why a withdrawn ask's link has nothing to do", async () => {
      const { intro } = await seedIntro({ state: INTRO_STATES.withdrawn, closedAt: new Date() });
      const token = await issueAnswerLink(database, intro.id, INTRO_LINK_PURPOSES.connector);

      expect(await viewOf(token)).toMatchObject({ view: LINK_VIEWS.closed, reason: CLOSED_REASONS.withdrawn, askerName: "Sam Lee" });
    });

    it("answers nothing for a token nobody issued, or one for another purpose", async () => {
      const { intro } = await seedIntro();
      const outcomeToken = await issueAnswerLink(database, intro.id, INTRO_LINK_PURPOSES.outcome);

      expect((await answerByLink({ purpose: "connector", token: "x".repeat(43), choice: "yes", targetEmail: TARGET_EMAIL, note: null })).status).toBe(410);
      expect((await answerByLink({ purpose: "connector", token: outcomeToken, choice: "yes", targetEmail: TARGET_EMAIL, note: null })).status).toBe(410);
      expect((await readRow(intro.id)).state).toBe(INTRO_STATES.requested);
      expect(await viewOf("y".repeat(43))).toMatchObject({ view: LINK_VIEWS.closed, reason: CLOSED_REASONS.unknown });
    });
  });

  describe("the outcome link", () => {
    async function seedIntroduced() {
      const introducedAt = new Date(Date.now() - 15 * DAY_MS);
      return seedIntro({ state: INTRO_STATES.completed, closedAt: introducedAt, askedTargetAt: introducedAt, targetAgreedAt: introducedAt });
    }

    it("records a helpful answer with what came of it, and thanks the connector once", async () => {
      const { intro, marcus } = await seedIntroduced();
      const token = await issueAnswerLink(database, intro.id, INTRO_LINK_PURPOSES.outcome);
      expect(await viewOf(token)).toMatchObject({ view: LINK_VIEWS.outcome, connectorName: "Marcus Webb", targetName: "Rosa Lindqvist" });

      expect(await (await answerByLink({ purpose: "outcome", token, outcome: "helpful", results: ["customer"] })).json()).toEqual({ result: "noted" });

      expect(await readRow(intro.id)).toMatchObject({ outcome: INTRO_OUTCOMES.helped, outcomeResults: ["customer"] });
      await vi.waitFor(async () => {
        const thanks = await database.select().from(emailOutbox).where(eq(emailOutbox.toEmail, await readEmail(marcus)));
        expect(thanks.map(({ subject }) => subject)).toEqual(["Sam found your intro helpful"]);
      });
    });

    it("counts 'too early' without a thank-you", async () => {
      const { intro, marcus } = await seedIntroduced();
      const token = await issueAnswerLink(database, intro.id, INTRO_LINK_PURPOSES.outcome);

      await answerByLink({ purpose: "outcome", token, outcome: "too_early", results: ["customer"] });

      expect(await readRow(intro.id)).toMatchObject({ outcome: INTRO_OUTCOMES.notYet, outcomeResults: null });
      expect(await database.select().from(emailOutbox).where(eq(emailOutbox.toEmail, await readEmail(marcus)))).toEqual([]);
    });
  });

  describe("stop intro asks", () => {
    it("saves the person's choice from a link whose ask already closed", async () => {
      const { intro } = await seedIntro({ state: INTRO_STATES.declined, closedAt: new Date() });
      const token = "s".repeat(43);
      await database.insert(introConsentLink).values({ introId: intro.id, tokenHash: createHash("sha256").update(token).digest("hex") });

      const response = await postConsentAnswer(
        new Request(`${APP_URL}/api/intros/consent/answer`, { method: "POST", headers: { "Content-Type": "application/json", Origin: APP_URL }, body: JSON.stringify({ token, answer: "stop_all_asks" }) }),
      );

      expect(await response.json()).toEqual({ answer: "stop_all_asks", isRepeat: false });
      expect(await database.select().from(introOptOut)).toHaveLength(1);
    });
  });
});
