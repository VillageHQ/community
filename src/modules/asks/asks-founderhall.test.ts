import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postAnswer } from "@/app/api/asks/answer/route";
import { POST as postCreate } from "@/app/api/asks/create/route";
import { POST as postHelp } from "@/app/api/asks/help/route";
import { POST as postStatus } from "@/app/api/asks/status/route";
import { POST as postFactCheck } from "@/app/api/profile/fill-in/check/route";
import { ASK_ALLOWANCE, ASK_ALLOWANCE_SETTING, ASK_OUTCOMES, createdAskSchema, describeAskWho, describeWhyYou } from "@/modules/asks/contract";
import { asksManifest } from "@/modules/asks/manifest";
import { readAskDetail, readAsksPage } from "@/modules/asks/reads-board";
import { ask, askAnswer, askHelper } from "@/modules/asks/schema";
import { renderHelperEmail } from "@/modules/asks/service-helpers";
import { renderHelpOfferedEmail } from "@/modules/asks/service-status";
import { memberFillIn } from "@/modules/members/schema";
import { readLinesToCheck, saveFilledProfile, saveFillInSettings } from "@/modules/members/service-fill-in";
import { user } from "@/platform/database/auth-schema";
import { emailOutbox } from "@/platform/email/schema";
import { saveModuleState } from "@/platform/modules/enablement";
import { saveSettings } from "@/platform/settings/store";
import { renderDigestHint } from "@/shell/weekly-email-answers";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { createSignedInMember } from "@/test/signed-in-member";

// Founderhall's Asks & updates and Today on Community's engine: the words of its emails, "I can help", the status
// buttons, the board's tabs, and "Is this right?".
const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const FORBIDDEN_STATUS = 403;
const ASK = "Looking for a plant manager with cement or ceramics experience, ideally in France.";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;

function call(handler: Handler, member: Member, body: unknown) {
  return handler(new Request(`${APP_URL}/api/asks`, { method: "POST", headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie }, body: JSON.stringify(body) }));
}

describe("Founderhall's asks and Today", () => {
  const database = createTestDatabase();
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let amara: Member;
  let priya: Member;
  let sam: Member;
  let admin: Member;

  async function post(member: Member, body: Record<string, unknown>) {
    const response = await call(postCreate, member, body);
    expect(response.status).toBe(OK_STATUS);
    return createdAskSchema.parse(await response.json()).id;
  }

  beforeAll(async () => {
    resend = await startFakeResendServer();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    resend.reset();
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind Founders <notify@example.com>");
    vi.stubEnv("RESEND_API_URL", resend.url);
    await saveModuleState(database, asksManifest, true);
    await saveSettings(database, { [ASK_ALLOWANCE_SETTING]: String(ASK_ALLOWANCE.maximum) });
    [amara, priya, sam, admin] = await Promise.all([createSignedInMember(database), createSignedInMember(database), createSignedInMember(database), createSignedInMember(database, "admin")]);
    await database.update(user).set({ name: "Amara Diallo" }).where(eq(user.id, amara.userId));
    await database.update(user).set({ name: "Priya Shah" }).where(eq(user.id, priya.userId));
    await database.update(user).set({ name: "Sam Lee" }).where(eq(user.id, sam.userId));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await resend.stop();
    await database.$client.end();
  });

  describe("the words", () => {
    it("writes the helper email word for word as Founderhall", () => {
      const email = renderHelperEmail(
        { APP_URL: "http://127.0.0.1:9600" } as never,
        { name: "Northwind Founders" } as never,
        { id: "11", title: "Who can intro me to a buyer at a US hospital group? We sell billing software to clinics.", authorName: "Sam Lee", targetText: "Head of procurement at a US hospital", targetCompany: null, targetName: null },
        { name: "Marcus Webb", reason: "path", why: "Worked together at Portline", personName: "Rosa Lindqvist", personTitle: "CTO at Halcyon Health", warmth: "close" },
        true,
      );
      expect(email.subject).toBe("Sam asks: Who can intro me to a buyer at a US hospital group? We sell billing…");
      expect(email.text).toBe(
        [
          "Hi Marcus,",
          "",
          "Sam Lee posted an ask in Northwind Founders:",
          "",
          "  Who can intro me to a buyer at a US hospital group? We sell billing software to clinics.",
          "",
          "Trying to reach: Head of procurement at a US hospital",
          "",
          "Why you: You know Rosa Lindqvist well (CTO at Halcyon Health). Worked together at Portline.",
          "",
          'Open the ask and say "I can help": http://127.0.0.1:9600/asks/11',
          "Or reply to this email: your reply shows under the ask, from you. Start it with HELP if you know someone.",
          "",
          "Nobody is introduced without saying yes. If you know someone, Sam writes the note and you decide whether to forward it.",
          "",
          "Stop emails about asks you could help with: [[unsubscribe-url]]",
          "",
          "Sent by Northwind Founders via its member portal.",
        ].join("\n"),
      );
    });

    it("writes the help-offered email word for word as Founderhall", () => {
      const email = renderHelpOfferedEmail({
        communityName: "Northwind Founders",
        authorName: "Amara Diallo",
        helperName: "Priya Shah",
        kind: "know_someone",
        note: "Dana ran supply chain at Mercy Ridge; we worked together for two years.",
        person: "Dana Morris",
        askTitle: ASK,
        link: "http://127.0.0.1:9600/intros/new?draft=7",
      });
      expect(email.subject).toBe("Priya can introduce you to Dana Morris");
      expect(email.text).toBe(
        [
          "Hi Amara,",
          "",
          "Priya Shah knows someone for your ask: Dana Morris.",
          "",
          `Your ask: ${ASK}`,
          "",
          "Priya wrote:",
          "",
          "  Dana ran supply chain at Mercy Ridge; we worked together for two years.",
          "",
          "Write the note Priya forwards (we drafted it from your profile): http://127.0.0.1:9600/intros/new?draft=7",
          "",
          "Nobody is introduced without saying yes.",
          "",
          "Sent by Northwind Founders via its member portal.",
        ].join("\n"),
      );
    });

    it("writes the digest reply notice word for word as Founderhall", () => {
      const email = renderDigestHint("Northwind Founders", "We couldn’t read a code like HELP 1 in your reply.", "https://portal.northwind.example/today");
      expect(email.subject).toBe("Your reply to the digest did not go through");
      expect(email.text).toBe(
        "We couldn’t read a code like HELP 1 in your reply.\n\nOpen this week’s items instead: https://portal.northwind.example/today\n\nSent by Northwind Founders via its member portal.",
      );
    });

    it("names who an ask is trying to reach, and why you, as Founderhall does", () => {
      expect(describeAskWho({ targetText: "VP Supply Chain at a US hospital", targetCompany: "Mercy Ridge Hospital" })).toBe("VP Supply Chain at a US hospital · Mercy Ridge Hospital");
      expect(describeAskWho({ targetText: "Head of procurement at Halcyon Health", targetCompany: "Halcyon Health" })).toBe("Head of procurement at Halcyon Health");
      expect(describeWhyYou({ reason: "words", why: "can help with “Raising a seed round in New York; HIPAA basics for first-time founders.”", personName: null, personTitle: null, warmth: null })).toBe(
        "Your profile says you can help with “Raising a seed round in New York; HIPAA basics for first-time founders.”",
      );
      expect(describeWhyYou({ reason: "path", why: "Met at a conference", personName: "Dana Morris", personTitle: null, warmth: "met" })).toBe("You’ve met Dana Morris. Met at a conference.");
    });
  });

  describe("I can help", () => {
    it("leaves a public line under the ask and tells the asker by email, once", async () => {
      const askId = await post(amara, { title: ASK, targetText: "a plant manager in cement" });

      const response = await call(postHelp, priya, { askId, kind: "know_someone", person: "Dana Morris", note: "Dana ran supply chain at Mercy Ridge; we worked together for two years." });
      expect(response.status).toBe(OK_STATUS);
      expect((await call(postHelp, priya, { askId, kind: "done_myself", note: "" })).status).toBe(OK_STATUS);

      const lines = await database.select({ body: askAnswer.body, kind: askAnswer.kind }).from(askAnswer).orderBy(askAnswer.createdAt);
      expect(lines).toEqual([
        { body: "Dana ran supply chain at Mercy Ridge; we worked together for two years.", kind: "know_someone" },
        { body: "I’ve done this myself. Happy to talk it through.", kind: "done_myself" },
      ]);
      const emails = await database.select({ subject: emailOutbox.subject, to: emailOutbox.toEmail }).from(emailOutbox).where(eq(emailOutbox.kind, "ask_help_offered"));
      expect(emails.map(({ subject }) => subject)).toEqual(["Priya can introduce you to Dana Morris", "Priya can help with your ask"]);
      expect(emails.every(({ to }) => to === amara.email)).toBe(true);

      const detail = await readAskDetail(database, { viewerId: sam.userId, askId });
      expect(detail?.answers.map(({ kind }) => kind)).toEqual(["know_someone", "done_myself"]);
    });

    it("can't be offered on your own ask", async () => {
      const askId = await post(amara, { title: ASK });
      expect((await call(postHelp, amara, { askId, kind: "done_myself", note: "" })).status).toBe(422);
    });
  });

  describe("the ask's buttons", () => {
    it("lets the author mark it answered and reopen it, an admin pin it, and nobody else touch it", async () => {
      const askId = await post(amara, { title: ASK });

      expect((await call(postStatus, sam, { askId, action: "answered" })).status).toBe(FORBIDDEN_STATUS);
      expect((await call(postStatus, sam, { askId, action: "pin" })).status).toBe(FORBIDDEN_STATUS);
      expect((await call(postStatus, admin, { askId, action: "pin" })).status).toBe(OK_STATUS);
      expect((await call(postStatus, amara, { askId, action: "answered" })).status).toBe(OK_STATUS);
      const [closed] = await database.select({ outcome: ask.outcome, pinnedAt: ask.pinnedAt }).from(ask).where(eq(ask.id, askId));
      expect(closed).toEqual({ outcome: ASK_OUTCOMES.solvedHere, pinnedAt: null });
      expect((await readAsksPage(database, { viewerId: sam.userId, tab: "answered", search: null })).posts.map(({ id }) => id)).toEqual([askId]);

      expect((await call(postStatus, amara, { askId, action: "reopen" })).status).toBe(OK_STATUS);
      // Asks & digest › Close: an admin ends someone else's ask as no longer needed, once.
      expect((await call(postStatus, sam, { askId, action: "close" })).status).toBe(FORBIDDEN_STATUS);
      expect((await call(postStatus, admin, { askId, action: "close" })).status).toBe(OK_STATUS);
      const [closedByAdmin] = await database.select({ outcome: ask.outcome, closedAt: ask.closedAt }).from(ask).where(eq(ask.id, askId));
      expect(closedByAdmin?.outcome).toBe(ASK_OUTCOMES.noLongerNeeded);
      expect(closedByAdmin?.closedAt).not.toBeNull();
      expect((await call(postStatus, admin, { askId, action: "close" })).status).toBe(409);
      expect((await call(postStatus, admin, { askId, action: "remove" })).status).toBe(OK_STATUS);
      expect(await database.select().from(ask).where(eq(ask.id, askId))).toEqual([]);
    });
  });

  describe("the board", () => {
    it("counts and lists Open, Updates, Yours and Answered, and searches every ask and its answers", async () => {
      const open = await post(amara, { title: ASK, targetText: "a plant manager in cement" });
      const update = await post(sam, { title: "We just signed our 40th clinic.", kind: "update" });
      const own = await post(sam, { title: "Who has hired a first VP Sales selling to US hospitals?" });
      await database.insert(askHelper).values({ askId: open, helperId: sam.userId, reason: "words", why: "can help with “Cement and ceramics”" });
      expect((await call(postAnswer, priya, { askId: open, body: "Try the kiln makers' trade group." })).status).toBe(OK_STATUS);

      const page = await readAsksPage(database, { viewerId: sam.userId, tab: "open", search: null });
      expect(page.counts).toEqual({ open: 2, updates: 1, yours: 2, answered: 0 });
      const card = page.posts.find(({ id }) => id === open);
      expect(card).toMatchObject({ who: "a plant manager in cement", helperCount: 1, answerCount: 1, viewerWhyYou: "Your profile says you can help with “Cement and ceramics”." });
      expect((await readAsksPage(database, { viewerId: sam.userId, tab: "updates", search: null })).posts.map(({ id }) => id)).toEqual([update]);
      expect((await readAsksPage(database, { viewerId: sam.userId, tab: "yours", search: null })).posts.map(({ id }) => id).toSorted()).toEqual([update, own].toSorted());
      expect((await readAsksPage(database, { viewerId: sam.userId, tab: "open", search: "kiln" })).posts.map(({ id }) => id)).toEqual([open]);
      expect((await readAsksPage(database, { viewerId: sam.userId, tab: "open", search: "nothing-matches" })).posts).toEqual([]);
    });
  });

  describe("Is this right?", () => {
    it("asks about a filled-in line until the member says Right, and again when a refresh changes it", async () => {
      await saveFillInSettings(database, { basis: "terms", termsDate: "2026-01-01" });
      await database.insert(memberFillIn).values({ userId: sam.userId, field: "location", value: "New York", filledAt: new Date(Date.now() - 9 * 86_400_000) });
      expect((await readLinesToCheck(database, sam.userId)).map(({ label, value }) => `${label} ${value}`)).toEqual(["City New York"]);

      expect((await call(postFactCheck, sam, { field: "location", answer: "right" })).status).toBe(OK_STATUS);
      expect(await readLinesToCheck(database, sam.userId)).toEqual([]);

      await saveFilledProfile(database, sam.userId, { location: "Boston" }, null);
      expect((await readLinesToCheck(database, sam.userId)).map(({ value }) => value)).toEqual(["Boston"]);

      expect((await call(postFactCheck, sam, { field: "location", answer: "fix", value: "Brooklyn" })).status).toBe(OK_STATUS);
      expect(await readLinesToCheck(database, sam.userId)).toEqual([]);
      expect((await call(postFactCheck, sam, { field: "location", answer: "hide" })).status).toBe(OK_STATUS);
    });
  });
});
