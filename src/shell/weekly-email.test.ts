import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postResendWebhook } from "@/app/api/email/resend-webhook/route";
import { POST as postUnsubscribe } from "@/app/api/email/unsubscribe/route";
import { POST as postWeeklyAnswer } from "@/app/api/email/weekly-answer/route";
import { asksManifest } from "@/modules/asks/manifest";
import { ask, askHelper, askOffer } from "@/modules/asks/schema";
import { askSkip } from "@/modules/asks/schema-skip";
import { INTRO_STATES } from "@/modules/intros/contract";
import { introRequest } from "@/modules/intros/schema";
import { memberFillIn, memberProfile } from "@/modules/members/schema";
import { user } from "@/platform/database/auth-schema";
import { EMAIL_TOPICS } from "@/platform/email/kinds";
import { sendDueEmails } from "@/platform/email/outbox-sender";
import { signResendWebhook } from "@/platform/email/resend-webhook";
import { emailOutbox } from "@/platform/email/schema";
import { setEmailTopic } from "@/platform/email/unsubscribe";
import { saveModuleState } from "@/platform/modules/enablement";
import { instanceSettings } from "@/platform/settings/schema";
import { readItemAction } from "@/platform/weekly-email/ledger";
import { DEFAULT_WEEKLY_SCHEDULE, readNextSend } from "@/platform/weekly-email/schedule";
import { weeklyEmail } from "@/platform/weekly-email/schema";
import { createItemToken } from "@/platform/weekly-email/tokens";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { joinMemberToGroup } from "@/test/intros";
import { seedMember } from "@/test/members";

import { readEnabledIds } from "./enabled-modules";
import { isTodayEmpty, readTodayItems } from "./today";
import { previewMemberDigest, previewWeeklyEmail, runWeeklyEmails, WEEKLY_PREVIEW_SOURCES } from "./weekly-email";
import { saveWeeklyEmailEnabled } from "./weekly-email-settings";

const APP_URL = "http://localhost:3000";
const REPLY_DOMAIN = "reply.example.com";
const WEBHOOK_SECRET = `whsec_${Buffer.from("a-webhook-secret-for-tests-only").toString("base64")}`;
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
const ASK_TITLE = "Looking for a fintech investor for our seed round";
const HELP_NOTE = "Happy to introduce you to two fintech investors.";

type RecordedBody = { to: string[]; subject: string; text: string; html: string; reply_to?: string; headers?: Record<string, string> };

describe("the Today home and the weekly email", () => {
  const database = createTestDatabase();
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  // A moment just after this week's send time, after every seeded member joined.
  const now = new Date((readNextSend(new Date(), DEFAULT_WEEKLY_SCHEDULE)?.at.getTime() ?? Date.now()) + HOUR_MS);

  const environment = () => process.env;

  function readBodies() {
    return resend.state.emails.map(({ body }) => body as RecordedBody);
  }

  // An ask routed to its helpers, as posting one does: Today and the weekly email show the asks a member was routed to.
  async function seedAsk(authorId: string, title = ASK_TITLE, helperIds: readonly string[] = []) {
    const [created] = await database.insert(ask).values({ authorId, title, detail: null, category: "intro" }).returning({ id: ask.id });
    if (!created) throw new Error("Expected an ask.");
    for (const helperId of helperIds) {
      await database.insert(askHelper).values({ askId: created.id, helperId, reason: "words", why: "can help with “Fintech, hiring and fundraising”" });
    }
    return created.id;
  }

  async function seedIntroAsk(requesterId: string, introducerId: string) {
    const [created] = await database
      .insert(introRequest)
      .values({
        requesterId,
        introducerId,
        targetLinkedinSlug: `target-${crypto.randomUUID()}`,
        targetName: "Jo Rivera",
        introducerName: "Hana Helper",
        introducerLinkedinSlug: `hana-${crypto.randomUUID()}`,
        reason: "Worked together",
        note: "Jo built the design team I want to build.",
        expiresAt: new Date(Date.now() + 30 * DAY_MS),
      })
      .returning({ id: introRequest.id });
    if (!created) throw new Error("Expected an intro.");
    return created.id;
  }

  async function readEmail(memberId: string) {
    const [row] = await database.select().from(user).where(eq(user.id, memberId));
    return row?.email ?? "";
  }

  // Hana can help with Alex's ask and has Rae's intro ask waiting. Quinn has nothing this week.
  async function seedCommunity() {
    const hana = await seedMember(database, { name: "Hana Helper", canHelpWith: "Fintech, hiring and fundraising" });
    const alex = await seedMember(database, { name: "Alex Asker" });
    const rae = await seedMember(database, { name: "Rae Requester" });
    const quinn = await seedMember(database, { name: "Quinn Quiet", canHelpWith: "Gardening" });
    await joinMemberToGroup(database, hana, `hana-${hana}`);
    await joinMemberToGroup(database, rae, `rae-${rae}`);
    const askId = await seedAsk(alex, ASK_TITLE, [hana]);
    const introId = await seedIntroAsk(rae, hana);
    return { hana, alex, rae, quinn, askId, introId };
  }

  function webhookRequest(payload: unknown) {
    const body = JSON.stringify(payload);
    const id = `msg_${crypto.randomUUID()}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    return new Request(`${APP_URL}/api/email/resend-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "svix-id": id,
        "svix-timestamp": timestamp,
        "svix-signature": `v1,${signResendWebhook(WEBHOOK_SECRET, id, timestamp, body)}`,
      },
      body,
    });
  }

  async function reply(from: string, to: string, text: string) {
    const response = await postResendWebhook(webhookRequest({ type: "email.received", data: { email_id: "received-1", from, to: [to], text } }));
    return (await response.json()) as { routed: boolean; reason: string | null; results: { code: string; outcome: string }[] };
  }

  async function readReplyTo(memberId: string) {
    const [row] = await database.select({ replyTo: emailOutbox.replyTo }).from(emailOutbox).where(eq(emailOutbox.memberId, memberId));
    return row?.replyTo ?? "";
  }

  beforeAll(async () => {
    resend = await startFakeResendServer();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    resend.reset();
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("BETTER_AUTH_SECRET", "a-test-auth-secret-with-at-least-32-characters");
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.com>");
    vi.stubEnv("RESEND_API_URL", resend.url);
    vi.stubEnv("RESEND_REPLY_DOMAIN", REPLY_DOMAIN);
    vi.stubEnv("RESEND_WEBHOOK_SECRET", WEBHOOK_SECRET);
    await saveModuleState(database, asksManifest, true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await resend.stop();
    await database.$client.end();
  });

  describe("Today", () => {
    it("shows a member the ask they could help with and why, and the intro waiting for their yes", async () => {
      const { hana, askId, introId } = await seedCommunity();
      const today = await readTodayItems(database, hana, await readEnabledIds(database), now);

      expect(today.helpableAsks.map(({ id, matchedWords }) => ({ id, matchedWords }))).toEqual([{ id: askId, matchedWords: ["fintech"] }]);
      expect(today.introsToAnswer.map(({ id }) => id)).toEqual([introId]);
      expect(isTodayEmpty(today)).toBe(false);
    });

    it("asks a member to check the lines public profiles just added to their card", async () => {
      const { quinn } = await seedCommunity();
      const hour = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR_MS);
      await database.insert(memberFillIn).values([
        { userId: quinn, field: "title", value: "Head of Growth", filledAt: hour(2) },
        { userId: quinn, field: "location", value: "Lisbon", filledAt: hour(3), hiddenAt: hour(1) },
        { userId: quinn, field: "headline", value: "Growth at a seed startup", filledAt: hour(20 * 24) },
        { userId: quinn, field: "face", value: "https://images.example.com/quinn.png", filledAt: hour(2) },
      ]);

      const today = await readTodayItems(database, quinn, await readEnabledIds(database), now);

      expect(today.profileLines).toEqual([{ field: "title", label: "Role", value: "Head of Growth", filledAt: hour(2).toISOString() }]);
      expect(isTodayEmpty(today)).toBe(false);
    });

    it("skips a filled-in line the member's own words replace", async () => {
      const { quinn } = await seedCommunity();
      await database.insert(memberFillIn).values({ userId: quinn, field: "company", value: "Filled Co", filledAt: now });
      await database.execute(sql`update member_profile set company = 'Own Words Ltd' where user_id = ${quinn}`);

      const today = await readTodayItems(database, quinn, await readEnabledIds(database), now);

      expect(today.profileLines).toEqual([]);
    });

    it("is calm and empty for a member with nothing this week", async () => {
      const { quinn } = await seedCommunity();
      const today = await readTodayItems(database, quinn, await readEnabledIds(database), now);

      expect(today.helpableAsks).toEqual([]);
      expect(today.introsToAnswer).toEqual([]);
      expect(isTodayEmpty(today)).toBe(true);
    });

    it("shows the asker their own ask in motion, not as one to help with", async () => {
      const { alex, askId } = await seedCommunity();
      const today = await readTodayItems(database, alex, await readEnabledIds(database), now);

      expect(today.helpableAsks).toEqual([]);
      expect(today.ownAsks.map(({ id }) => id)).toEqual([askId]);
    });

    it("leaves out asks when the asks feature is off", async () => {
      const { hana } = await seedCommunity();
      await saveModuleState(database, asksManifest, false);
      const today = await readTodayItems(database, hana, await readEnabledIds(database), now);

      expect(today.helpableAsks).toEqual([]);
      expect(today.ownAsks).toEqual([]);
    });
  });

  describe("the weekly run", () => {
    it("sends one numbered email to each member with items and none to the others", async () => {
      const { hana } = await seedCommunity();

      const summary = await runWeeklyEmails(database, environment(), { now });
      await sendDueEmails(database, environment());

      expect(summary).toMatchObject({ queued: 1, empty: 3, failed: 0 });
      const bodies = readBodies();
      expect(bodies).toHaveLength(1);
      expect(bodies[0]?.to).toEqual([await readEmail(hana)]);
      expect(bodies[0]?.subject).toBe("Hana, you could help with this one");
      expect(bodies[0]?.text).toContain(`1. Alex Asker asks: ${ASK_TITLE}`);
      expect(bodies[0]?.text).toContain("   Why you: Your profile says you can help with “Fintech, hiring and fundraising”.");
      expect(bodies[0]?.text).toContain("   Or reply HELP 1 with a line for Alex · SKIP 1");
      expect(bodies[0]?.text).toContain("2. Rae Requester asks you to introduce them to Jo Rivera.");
      expect(bodies[0]?.text).toContain("That’s everything this week. Open the portal:");
      // One ending: the member's own unsubscribe link on the stop line, then the foot, and no generic footer.
      expect(bodies[0]?.text).toMatch(/Nobody is introduced without saying yes\.\n\nStop the weekly digest: http\S+\/unsubscribe\?token=\S+\n\nSent by Your community via its member portal\.$/u);
      expect(bodies[0]?.text).not.toContain("[[");
      expect(bodies[0]?.text).not.toContain("Turn them off");
      expect(bodies[0]?.html).toMatch(/Stop the weekly digest: http[^<\s]+\/unsubscribe\?token=/u);
      expect(bodies[0]?.reply_to).toMatch(new RegExp(`^reply\\+[0-9a-f]{32}-[0-9a-f]{20}@${REPLY_DOMAIN.replaceAll(".", "\\.")}$`));
      expect(bodies[0]?.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    });

    it("sends nothing on a second run the same week", async () => {
      await seedCommunity();
      await runWeeklyEmails(database, environment(), { now });

      const second = await runWeeklyEmails(database, environment(), { now: new Date(now.getTime() + 2 * HOUR_MS) });

      expect(second).toMatchObject({ queued: 0, empty: 0 });
      expect(await database.select().from(emailOutbox)).toHaveLength(1);
    });

    it("finishes the rest after a run that stopped part way", async () => {
      const { askId } = await seedCommunity();
      const second = await seedMember(database, { name: "Sam Second", canHelpWith: "fintech" });
      const third = await seedMember(database, { name: "Tess Third", canHelpWith: "investor intros" });
      await database.insert(askHelper).values([second, third].map((helperId) => ({ askId, helperId, reason: "words", why: "can help with “fintech”" })));

      const stopped = await runWeeklyEmails(database, environment(), { now, maximumMembers: 2 });
      const resumed = await runWeeklyEmails(database, environment(), { now });

      expect(stopped.queued + stopped.empty + stopped.notWanted).toBe(2);
      expect(stopped.queued + resumed.queued).toBe(3);
      const rows = await database.select({ memberId: weeklyEmail.memberId, status: weeklyEmail.status }).from(weeklyEmail);
      expect(rows).toHaveLength(6);
      const outbox = await database.select({ memberId: emailOutbox.memberId }).from(emailOutbox);
      expect(new Set(outbox.map(({ memberId }) => memberId)).size).toBe(3);
      expect(outbox.map(({ memberId }) => memberId)).toEqual(expect.arrayContaining([second, third]));
      expect(askId).toBeTruthy();
    });

    it("skips a member who turned it off, and one-click unsubscribe turns it off", async () => {
      const { hana } = await seedCommunity();
      await runWeeklyEmails(database, environment(), { now });
      await sendDueEmails(database, environment());
      const unsubscribeUrl = readBodies()[0]?.headers?.["List-Unsubscribe"]?.slice(1, -1) ?? "";

      const response = await postUnsubscribe(new Request(unsubscribeUrl, { method: "POST", body: "List-Unsubscribe=One-Click" }));
      await database.delete(weeklyEmail);
      await database.delete(emailOutbox);
      const nextWeek = await runWeeklyEmails(database, environment(), { now });

      expect(response.status).toBe(200);
      expect(nextWeek.queued).toBe(0);
      expect(await database.select().from(emailOutbox)).toEqual([]);
      await setEmailTopic(database, { memberId: hana, topic: EMAIL_TOPICS.weekly }, true);
      expect((await runWeeklyEmails(database, environment(), { now })).queued).toBe(1);
    });

    it("never sends twice in six days when the admin moves the day, then keeps to the new day", async () => {
      const { hana } = await seedCommunity();
      await runWeeklyEmails(database, environment(), { now });
      await database.insert(instanceSettings).values({ key: "weekly_email_weekday", value: String((now.getUTCDay() + 1) % 7) });

      const moved = await runWeeklyEmails(database, environment(), { now: new Date(now.getTime() + DAY_MS) });
      const dayBefore = await runWeeklyEmails(database, environment(), { now: new Date(now.getTime() + 7 * DAY_MS) });
      const newDay = await runWeeklyEmails(database, environment(), { now: new Date(now.getTime() + 8 * DAY_MS) });

      expect(moved.queued).toBe(0);
      expect(dayBefore.queued).toBe(0);
      expect(newDay.queued).toBe(1);
      const sent = await database.select({ createdAt: weeklyEmail.createdAt }).from(weeklyEmail).where(eq(weeklyEmail.memberId, hana));
      expect(sent.map(({ createdAt }) => createdAt.getUTCDay()).toSorted()).toEqual([now.getUTCDay(), (now.getUTCDay() + 1) % 7].toSorted());
    });
  });

  describe("answering", () => {
    it("posts the help from a HELP 1 reply once, and a repeat does nothing", async () => {
      const { hana, askId } = await seedCommunity();
      await runWeeklyEmails(database, environment(), { now });
      const replyTo = await readReplyTo(hana);
      const from = `Hana Helper <${await readEmail(hana)}>`;

      const first = await reply(from, replyTo, `HELP 1\n${HELP_NOTE}\n\nOn Thu, Northwind wrote:\n> 1. ${ASK_TITLE}`);
      const repeat = await reply(from, replyTo, "HELP 1\nSaying it again.");

      expect(first.results).toEqual([{ code: "HELP 1", outcome: "done" }]);
      expect(repeat.results).toEqual([{ code: "HELP 1", outcome: "already" }]);
      const offers = await database.select({ note: askOffer.note }).from(askOffer).where(eq(askOffer.askId, askId));
      expect(offers).toEqual([{ note: HELP_NOTE }]);
    });

    it("reads the reply's words from Resend when the event carries none, as Resend sends it", async () => {
      const { hana, askId } = await seedCommunity();
      await runWeeklyEmails(database, environment(), { now });
      resend.state.receivedText = `HELP 1
${HELP_NOTE}`;

      const response = await postResendWebhook(
        webhookRequest({ type: "email.received", data: { email_id: "received-2", from: await readEmail(hana), to: [await readReplyTo(hana)] } }),
      );

      expect(await response.json()).toMatchObject({ results: [{ code: "HELP 1", outcome: "done" }] });
      expect(await database.select({ note: askOffer.note }).from(askOffer).where(eq(askOffer.askId, askId))).toEqual([{ note: HELP_NOTE }]);
    });

    it("says nothing changed when the member already offered help in the app", async () => {
      const { hana, askId } = await seedCommunity();
      await runWeeklyEmails(database, environment(), { now });
      await database.insert(askOffer).values({ askId, helperId: hana, note: "Offered in the app." });

      const result = await reply(await readEmail(hana), await readReplyTo(hana), "HELP 1");

      expect(result.results).toEqual([{ code: "HELP 1", outcome: "already" }]);
    });

    it("ignores a reply from another address", async () => {
      const { hana, askId } = await seedCommunity();
      await runWeeklyEmails(database, environment(), { now });

      const result = await reply("someone@example.com", await readReplyTo(hana), "HELP 1");

      expect(result).toMatchObject({ routed: true, reason: "sender_does_not_match", results: [] });
      expect(await database.select().from(askOffer).where(eq(askOffer.askId, askId))).toEqual([]);
    });

    it("answers NO 2 on the intro, and refuses a code that doesn't fit the item", async () => {
      const { hana, introId } = await seedCommunity();
      await runWeeklyEmails(database, environment(), { now });

      const result = await reply(await readEmail(hana), await readReplyTo(hana), "YES 1\nNO 2");

      expect(result.results).toEqual([
        { code: "YES 1", outcome: "wrong_code" },
        { code: "NO 2", outcome: "done" },
      ]);
      const [intro] = await database.select({ state: introRequest.state }).from(introRequest).where(eq(introRequest.id, introId));
      expect(intro?.state).toBe(INTRO_STATES.declined);
    });

    it("acts on a link only when its button posts, once", async () => {
      const { hana, askId } = await seedCommunity();
      await runWeeklyEmails(database, environment(), { now });
      const [row] = await database.select({ id: weeklyEmail.id }).from(weeklyEmail).where(eq(weeklyEmail.memberId, hana));
      const token = await createItemToken(database, environment(), { weeklyEmailId: row?.id ?? "", itemNumber: 1, action: "skip" });
      const answer = () =>
        postWeeklyAnswer(new Request(`${APP_URL}/api/email/weekly-answer?token=${encodeURIComponent(token)}`, { method: "POST" }));

      expect(await readItemAction(database, row?.id ?? "", 1)).toBeNull();
      const first = (await (await answer()).json()) as { outcome: string };
      const second = (await (await answer()).json()) as { outcome: string };
      const forged = await postWeeklyAnswer(new Request(`${APP_URL}/api/email/weekly-answer?token=${encodeURIComponent(`${token}x`)}`, { method: "POST" }));

      expect(first.outcome).toBe("done");
      expect(second.outcome).toBe("already");
      expect(forged.status).toBe(400);
      expect(await database.select().from(askSkip).where(eq(askSkip.askId, askId))).toHaveLength(1);
      const today = await readTodayItems(database, hana, await readEnabledIds(database), now);
      expect(today.helpableAsks).toEqual([]);
    });
  });

  // The 2026-11-12 parity audit (TODAY-06): Founderhall numbers the lines filled in from public profiles and takes
  // RIGHT / HIDE / FIX by reply or link, as it takes HELP / SKIP / YES / NO.
  describe("lines on the profile", () => {
    async function seedFilledLine(memberId: string) {
      await database.insert(memberFillIn).values({ userId: memberId, field: "location", value: "Lisbon", filledAt: new Date(now.getTime() - 2 * HOUR_MS) });
    }

    async function readLine(memberId: string) {
      const [line] = await database.select().from(memberFillIn).where(eq(memberFillIn.userId, memberId));
      const [profile] = await database.select({ location: memberProfile.location }).from(memberProfile).where(eq(memberProfile.userId, memberId));
      return { confirmed: line?.confirmedAt !== null, hidden: line?.hiddenAt !== null, own: profile?.location ?? null };
    }

    async function sendTo(memberId: string) {
      await runWeeklyEmails(database, environment(), { now });
      await sendDueEmails(database, environment());
      return { replyTo: await readReplyTo(memberId), from: await readEmail(memberId) };
    }

    it("numbers each line after the asks and intros, with its links and codes", async () => {
      const { hana } = await seedCommunity();
      await seedFilledLine(hana);

      await sendTo(hana);

      const text = readBodies()[0]?.text ?? "";
      expect(text).toContain("3. City: Lisbon");
      expect(text).toMatch(/ {3}Right: http\S+\/weekly\?token=\S+\n {3}Hide it: http\S+\/weekly\?token=\S+\n {3}Fix it: http\S+\/weekly\?token=\S+/u);
      expect(text).toContain("   Or reply RIGHT 3 · HIDE 3 · FIX 3 your own words");
    });

    it("marks a line right, hides one, and saves the member's own words, once each", async () => {
      const { quinn } = await seedCommunity();
      await seedFilledLine(quinn);
      const { replyTo, from } = await sendTo(quinn);

      expect((await reply(from, replyTo, "RIGHT 1")).results).toEqual([{ code: "RIGHT 1", outcome: "done" }]);
      expect(await readLine(quinn)).toMatchObject({ confirmed: true, hidden: false });
      expect((await reply(from, replyTo, "HIDE 1")).results).toEqual([{ code: "HIDE 1", outcome: "already" }]);
    });

    it("hides a line from a HIDE reply", async () => {
      const { quinn } = await seedCommunity();
      await seedFilledLine(quinn);
      const { replyTo, from } = await sendTo(quinn);

      expect((await reply(from, replyTo, "hide 1")).results).toEqual([{ code: "HIDE 1", outcome: "done" }]);
      expect(await readLine(quinn)).toMatchObject({ hidden: true });
    });

    it("saves FIX's words on the card, and asks for words when there are none", async () => {
      const { quinn } = await seedCommunity();
      await seedFilledLine(quinn);
      const { replyTo, from } = await sendTo(quinn);

      expect((await reply(from, replyTo, "FIX 1")).results).toEqual([{ code: "FIX 1", outcome: "needs_words" }]);
      expect(await readLine(quinn)).toMatchObject({ confirmed: false, own: null });
      expect((await reply(from, replyTo, "FIX 1 Porto\n\nThanks")).results).toEqual([{ code: "FIX 1", outcome: "done" }]);
      expect(await readLine(quinn)).toMatchObject({ confirmed: true, own: "Porto" });
    });

    it("takes FIX's words from the link page's field", async () => {
      const { quinn } = await seedCommunity();
      await seedFilledLine(quinn);
      await sendTo(quinn);
      const [row] = await database.select({ id: weeklyEmail.id }).from(weeklyEmail).where(eq(weeklyEmail.memberId, quinn));
      const token = await createItemToken(database, environment(), { weeklyEmailId: row?.id ?? "", itemNumber: 1, action: "fix" });

      const response = await postWeeklyAnswer(
        new Request(`${APP_URL}/api/email/weekly-answer?token=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ words: "Porto" }),
        }),
      );

      expect(response.headers.get("location")).toContain("result=done");
      expect(await readLine(quinn)).toMatchObject({ confirmed: true, own: "Porto" });
    });
  });

  // The 2026-11-12 parity audit (TODAY-05): after the button, the page didn't change. The server may see itself under
  // another address than the browser (127.0.0.1 or localhost, a proxy's inside name), and the page's form-action
  // 'self' rule blocks a redirect to any other address, so the answer goes back to the same site by path.
  describe("the link page's button", () => {
    it("goes back to the page on the same site, saying it's done", async () => {
      const { hana } = await seedCommunity();
      await runWeeklyEmails(database, environment(), { now });
      const [row] = await database.select({ id: weeklyEmail.id }).from(weeklyEmail).where(eq(weeklyEmail.memberId, hana));
      const token = await createItemToken(database, environment(), { weeklyEmailId: row?.id ?? "", itemNumber: 1, action: "skip" });

      const response = await postWeeklyAnswer(
        new Request(`http://localhost:3000/api/email/weekly-answer?token=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Host: "community.example.com" },
          body: "",
        }),
      );

      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(`/weekly?token=${encodeURIComponent(token)}&result=done`);
    });
  });

  describe("the admin preview", () => {
    it("shows the admin's own week or a made-up member, never another member's items", async () => {
      await seedCommunity();
      const admin = await seedMember(database, { name: "Ada Admin" });
      await database.update(user).set({ role: "admin" }).where(eq(user.id, admin));
      const session = { id: admin, email: await readEmail(admin), role: "admin" };

      const mine = await previewWeeklyEmail(database, environment(), session, WEEKLY_PREVIEW_SOURCES.mine);
      const sample = await previewWeeklyEmail(database, environment(), session, WEEKLY_PREVIEW_SOURCES.sample);

      for (const preview of [mine, sample]) {
        expect(preview.text).not.toContain(ASK_TITLE);
        expect(preview.text).not.toContain("Rae Requester");
        expect(preview.text).not.toContain("Hana");
      }
      expect(mine.isEmpty).toBe(true);
      expect(sample.text).toContain("Priya Shah");
      expect(sample.text).not.toContain("token=");
    });

    it("previews another member's digest with who asked whom, and never the note", async () => {
      const { hana } = await seedCommunity();
      const admin = await seedMember(database, { name: "Ada Admin" });
      await database.update(user).set({ role: "admin" }).where(eq(user.id, admin));
      const session = { id: admin, email: await readEmail(admin), role: "admin" };

      const preview = await previewMemberDigest(database, environment(), session, hana);

      expect(preview?.text).toContain(`1. Alex Asker asks: ${ASK_TITLE}`);
      expect(preview?.text).toContain("2. Rae Requester asks you to introduce them to Jo Rivera.");
      expect(preview?.text).not.toContain("Jo built the design team I want to build.");
      expect(preview?.text).not.toContain("token=");
    });

    it("stays quiet while an admin has switched the weekly digest off", async () => {
      await seedCommunity();
      await saveWeeklyEmailEnabled(database, false);

      expect((await runWeeklyEmails(database, environment(), { now })).queued).toBe(0);
    });
  });

  describe("the feed switch", () => {
    const migration = readFileSync(resolve(import.meta.dirname, "../../drizzle/0021_today_weekly.sql"), "utf8");
    const feedRule = migration.split("--> statement-breakpoint").at(-1) ?? "";

    async function readFeedState() {
      const [row] = await database.select({ value: instanceSettings.value }).from(instanceSettings).where(eq(instanceSettings.key, "module_state:feed"));
      return row?.value ?? null;
    }

    it("keeps the feed on for a community that already has members", async () => {
      await seedMember(database, { name: "Early Member" });
      await database.execute(sql.raw(feedRule));
      expect(await readFeedState()).toBe("on");
    });

    // The default turned on later (the owner's call, 2026-11-12): a community with no stored choice has the feed.
    it("leaves a new community with no members on the default, on", async () => {
      await database.execute(sql.raw(feedRule));
      expect(await readFeedState()).toBeNull();
      expect((await readEnabledIds(database)).has("feed")).toBe(true);
    });

    it("never changes a stored choice", async () => {
      await seedMember(database, { name: "Early Member" });
      await database.insert(instanceSettings).values({ key: "module_state:feed", value: "off" });
      await database.execute(sql.raw(feedRule));
      expect(await readFeedState()).toBe("off");
    });
  });
});
