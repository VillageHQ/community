import { and, eq, ne } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postResendWebhook } from "@/app/api/email/resend-webhook/route";
import { asksManifest } from "@/modules/asks/manifest";
import { ask, askAnswer } from "@/modules/asks/schema";
import { routeAskToHelpers } from "@/modules/asks/service-helpers";
import { INTRO_STATES } from "@/modules/intros/contract";
import { INTRO_EMAIL_EVENTS, queueIntroEmail } from "@/modules/intros/email";
import { sendJoiningEmail } from "@/modules/intros/email-target";
import { introsManifest } from "@/modules/intros/manifest";
import { introRequest, introThreadMessage } from "@/modules/intros/schema";
import { readIntroThreadForRequester } from "@/modules/intros/service-thread";
import { messagesManifest } from "@/modules/messages/manifest";
import { directMessage } from "@/modules/messages/schema";
import { sendMessage } from "@/modules/messages/service";
import { networkManifest } from "@/modules/network/manifest";
import { user } from "@/platform/database/auth-schema";
import { ROUTES } from "@/platform/http/routes";
import { EMAIL_KINDS } from "@/platform/email/kinds";
import { readEmailBranding } from "@/platform/email/outbox";
import { signResendWebhook } from "@/platform/email/resend-webhook";
import { emailOutbox } from "@/platform/email/schema";
import { createRequestContext } from "@/platform/http/request-context";
import { saveModuleState } from "@/platform/modules/enablement";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { joinMemberToGroup } from "@/test/intros";
import { seedMember } from "@/test/members";
import { seedConversation } from "@/test/messages";

import { mayMessage } from "./message-policy";

const APP_URL = "http://localhost:3000";
const REPLY_DOMAIN = "reply.example.com";
const WEBHOOK_SECRET = `whsec_${Buffer.from("a-webhook-secret-for-reply-tests").toString("base64")}`;
const DAY_MS = 24 * 60 * 60_000;
const OUTSIDER_EMAIL = "jo.rivera@outside.example";
const QUOTED = "\n\nOn Tue, 10 Nov 2026 at 09:00, Northwind <hello@example.com> wrote:\n> the email we sent\n> with its link";

type ReplyAnswer = { routed: boolean; kind: string | null; outcome: string; reason: string | null };
type RecordedBody = { to: string[]; subject: string; text: string; reply_to?: string };

describe("answering by replying to the email", () => {
  const database = createTestDatabase();
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let emailCount = 0;

  function webhookRequest(payload: unknown) {
    const body = JSON.stringify(payload);
    const id = `msg_${crypto.randomUUID()}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    return new Request(`${APP_URL}/api/email/resend-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signResendWebhook(WEBHOOK_SECRET, id, timestamp, body)}` },
      body,
    });
  }

  // A fake Resend inbound post. Attachments come along, as Resend sends their names; nothing reads them.
  async function reply(from: string, to: string | string[], text: string | null, emailId = `received-${(emailCount += 1)}`, extra: Record<string, unknown> = {}) {
    const data = { email_id: emailId, from, to: [to].flat(), text, attachments: [{ filename: "deck.pdf", content_type: "application/pdf" }], ...extra };
    const response = await postResendWebhook(webhookRequest({ type: "email.received", data }));
    return (await response.json()) as ReplyAnswer;
  }

  async function readEmail(memberId: string) {
    const [row] = await database.select({ email: user.email }).from(user).where(eq(user.id, memberId));
    return row?.email ?? "";
  }

  // The outbox sends right away and clears a sent row's words, so those come from what the fake Resend received.
  async function readQueued(kind: string, to?: string) {
    const rows = (await database.select().from(emailOutbox).where(eq(emailOutbox.kind, kind))).filter((row) => !to || row.toEmail === to);
    return Promise.all(
      rows.map(async (row) => {
        if (row.text) return row;
        const text = await vi.waitFor(() => {
          const sent = resend.state.emails.find(({ idempotencyKey }) => idempotencyKey === row.id);
          if (!sent) throw new Error("Not sent yet.");
          return (sent.body as RecordedBody).text;
        });
        return { ...row, text };
      }),
    );
  }

  function context(memberId: string, email: string) {
    return createRequestContext(database, process.env, { id: memberId, email, role: "user" });
  }

  function forge(address: string) {
    return address.replace(/-([0-9a-f]+)@/, (_, signature: string) => `-${signature.startsWith("0") ? "1" : "0"}${signature.slice(1)}@`);
  }

  async function seedIntro(requesterId: string, introducerId: string, state: string = INTRO_STATES.requested, targetEmail: string | null = null) {
    const [created] = await database
      .insert(introRequest)
      .values({
        requesterId,
        introducerId,
        state,
        targetEmail,
        targetLinkedinSlug: `jo-${crypto.randomUUID()}`,
        targetName: "Jo Rivera",
        introducerName: "Hana Helper",
        introducerLinkedinSlug: `hana-${crypto.randomUUID()}`,
        reason: "Worked together",
        note: "Jo built the design team I want to build.",
        expiresAt: new Date(Date.now() + 30 * DAY_MS),
      })
      .returning();
    if (!created) throw new Error("Expected an intro.");
    return created;
  }

  async function seedPeople() {
    const hana = await seedMember(database, { name: "Hana Helper", canHelpWith: "Fintech, hiring and fundraising" });
    const alex = await seedMember(database, { name: "Alex Asker" });
    const sam = await seedMember(database, { name: "Sam Stranger" });
    await joinMemberToGroup(database, hana, `hana-${hana}`);
    await joinMemberToGroup(database, alex, `alex-${alex}`);
    return { hana, alex, sam, hanaEmail: await readEmail(hana), alexEmail: await readEmail(alex), samEmail: await readEmail(sam) };
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
    for (const manifest of [messagesManifest, networkManifest, introsManifest, asksManifest]) await saveModuleState(database, manifest, true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await resend.stop();
    await database.$client.end();
  });

  describe("a new-message email", () => {
    async function seedMessageEmail() {
      const people = await seedPeople();
      const conversationId = await seedConversation(database, people.alex, people.hana);
      await sendMessage(context(people.alex, people.alexEmail), { conversationId, clientKey: crypto.randomUUID(), body: "Are you free Thursday?" }, mayMessage);
      const [email] = await readQueued(EMAIL_KINDS.directMessage, people.hanaEmail);
      return { ...people, conversationId, replyTo: email?.replyTo ?? "", text: email?.text ?? "" };
    }

    it("posts the reply into the conversation, without the quoted email or the signature", async () => {
      const { hana, hanaEmail, conversationId, replyTo, text } = await seedMessageEmail();
      expect(replyTo).toMatch(new RegExp(`^reply\\+m[0-9a-f]{32}-[0-9a-f]{20}@${REPLY_DOMAIN}$`));
      expect(text).toContain("Reply to this email to answer, or open it in the portal: ");

      const answer = await reply(`Hana Helper <${hanaEmail.toUpperCase()}>`, replyTo, `Thursday works.\n\n-- \nHana\nHelper & Co${QUOTED}`);

      expect(answer).toMatchObject({ routed: true, kind: "m", outcome: "posted" });
      const messages = await database.select().from(directMessage).where(and(eq(directMessage.conversationId, conversationId), eq(directMessage.senderId, hana)));
      expect(messages.map(({ body }) => body)).toEqual(["Thursday works."]);
      // The thread marks it "by email"; one typed in the app is not.
      expect(messages.map(({ isViaEmail }) => isViaEmail)).toEqual([true]);
      const [typed] = await database.select().from(directMessage).where(and(eq(directMessage.conversationId, conversationId), ne(directMessage.senderId, hana)));
      expect(typed?.isViaEmail).toBe(false);
    });

    it("posts once when Resend sends the same reply twice", async () => {
      const { hana, hanaEmail, replyTo } = await seedMessageEmail();
      await reply(hanaEmail, replyTo, "Thursday works.", "received-same");
      await reply(hanaEmail, replyTo, "Thursday works.", "received-same");
      expect(await database.select().from(directMessage).where(eq(directMessage.senderId, hana))).toHaveLength(1);
    });

    it("refuses a reply from another address, posts nothing of it, and sends that address one plain bounce", async () => {
      const { samEmail, conversationId, replyTo } = await seedMessageEmail();

      expect(await reply(samEmail, replyTo, "Let me in.")).toMatchObject({ routed: true, outcome: "refused", reason: "wrong_sender" });
      expect(await reply(samEmail, replyTo, "Let me in again.")).toMatchObject({ reason: "wrong_sender" });

      expect(await database.select().from(directMessage).where(eq(directMessage.conversationId, conversationId))).toHaveLength(1);
      const bounces = await readQueued(EMAIL_KINDS.replyNotice, samEmail);
      expect(bounces).toHaveLength(1);
      expect(bounces[0]?.subject).toBe("Your reply did not go through");
      expect(bounces[0]?.text).toContain("different address");
      expect(bounces[0]?.text).toContain(`Use this link instead: ${APP_URL}${ROUTES.messages}/${conversationId}`);
      expect(bounces[0]?.text).toMatch(/\n\nSent by .+ via its member portal\.$/);
      expect(bounces[0]?.text).not.toContain("Let me in");
    });

    it("ignores an out-of-office reply, and decodes an HTML-only reply", async () => {
      const { hana, hanaEmail, replyTo } = await seedMessageEmail();

      expect(await reply(hanaEmail, replyTo, "I'm away until Monday.", undefined, { subject: "Automatic reply: Alex Asker sent you a message" })).toMatchObject({ reason: "automatic" });
      expect(await reply(hanaEmail, replyTo, "I'm away.", undefined, { headers: [{ name: "Auto-Submitted", value: "auto-replied" }] })).toMatchObject({ reason: "automatic" });
      expect(await reply(hanaEmail, replyTo, null, undefined, { html: "<p>It&#8217;s fine &amp; good&nbsp;&mdash; ok</p><blockquote>old email</blockquote>" })).toMatchObject({ outcome: "posted" });

      const bodies = (await database.select().from(directMessage).where(eq(directMessage.senderId, hana))).map(({ body }) => body);
      expect(bodies).toEqual(["It’s fine & good — ok"]);
      expect(await readQueued(EMAIL_KINDS.replyNotice)).toHaveLength(0);
    });

    it("uses the real address when a made-up one is listed before it", async () => {
      const { hanaEmail, conversationId, replyTo } = await seedMessageEmail();
      const madeUp = `reply+m${"0".repeat(32)}-${"0".repeat(20)}@${REPLY_DOMAIN}`;
      expect(await reply(hanaEmail, [madeUp, replyTo], "Thursday works.")).toMatchObject({ outcome: "posted" });
      expect(await database.select().from(directMessage).where(eq(directMessage.conversationId, conversationId))).toHaveLength(2);
    });

    it("uses the address made for the sender when the other member's is listed first", async () => {
      const { alex, alexEmail, hana, hanaEmail, conversationId, replyTo } = await seedMessageEmail();
      await sendMessage(context(hana, hanaEmail), { conversationId, clientKey: crypto.randomUUID(), body: "Hi Alex" }, mayMessage);
      const [toAlex] = await readQueued(EMAIL_KINDS.directMessage, alexEmail);

      expect(await reply(hanaEmail, [toAlex?.replyTo ?? "", replyTo], "Thursday works.")).toMatchObject({ outcome: "posted" });
      expect(await database.select().from(directMessage).where(eq(directMessage.senderId, alex))).toHaveLength(1);
      expect(await database.select().from(directMessage).where(eq(directMessage.senderId, hana))).toHaveLength(2);
    });

    it("refuses a forged address and mails nobody", async () => {
      const { hanaEmail, conversationId, replyTo } = await seedMessageEmail();

      expect(await reply(hanaEmail, forge(replyTo), "Forged.")).toMatchObject({ routed: true, outcome: "refused", reason: "forged" });
      // The other member's address, signed for Hana, isn't Alex's either.
      expect(await database.select().from(directMessage).where(eq(directMessage.conversationId, conversationId))).toHaveLength(1);
      expect(await readQueued(EMAIL_KINDS.replyNotice)).toHaveLength(0);
    });

    it("bounces a reply that is empty once the quoted email is gone, or too long", async () => {
      const { hanaEmail, conversationId, replyTo } = await seedMessageEmail();

      expect(await reply(hanaEmail, replyTo, QUOTED)).toMatchObject({ reason: "empty" });
      expect(await reply(hanaEmail, replyTo, "x".repeat(4001))).toMatchObject({ reason: "too_long" });
      expect(await database.select().from(directMessage).where(eq(directMessage.conversationId, conversationId))).toHaveLength(1);
      expect(await readQueued(EMAIL_KINDS.replyNotice, hanaEmail)).toHaveLength(1);
    });
  });

  describe("the connector's intro email", () => {
    async function seedAskedEmail() {
      const people = await seedPeople();
      const intro = await seedIntro(people.alex, people.hana);
      const branding = await readEmailBranding(database, process.env);
      await database.transaction((transaction) => queueIntroEmail(transaction, process.env, branding, intro.id, INTRO_EMAIL_EVENTS.asked));
      const [email] = await readQueued(EMAIL_KINDS.introAsked, people.hanaEmail);
      return { ...people, intro, replyTo: email?.replyTo ?? "", text: email?.text ?? "" };
    }

    async function readState(introId: string) {
      const [row] = await database.select({ state: introRequest.state }).from(introRequest).where(eq(introRequest.id, introId));
      return row?.state;
    }

    it("takes YES with the person's address: the intro moves on, and the person asked gets the note", async () => {
      const { hanaEmail, intro, replyTo, text } = await seedAskedEmail();
      expect(text).toContain("YES or NO on the first line");

      // Mail apps write a linked address in brackets.
      const answer = await reply(hanaEmail, replyTo, `Yes, <mailto:${OUTSIDER_EMAIL}>${QUOTED}`);

      expect(answer).toMatchObject({ routed: true, kind: "i", outcome: "posted" });
      expect(await readState(intro.id)).toBe(INTRO_STATES.askingTarget);
      const sent = resend.state.emails.map(({ body }) => body as RecordedBody);
      expect(sent.some(({ to }) => to.includes(OUTSIDER_EMAIL))).toBe(true);
      const [notice] = await readQueued(EMAIL_KINDS.replyNotice, hanaEmail);
      expect(notice?.text).toContain(`We emailed Jo Rivera at ${OUTSIDER_EMAIL}`);
    });

    it("takes NO, and asks again when the first line is neither", async () => {
      const { hanaEmail, intro, replyTo } = await seedAskedEmail();

      expect(await reply(hanaEmail, replyTo, "No problem, happy to think about it")).toMatchObject({ reason: "unclear" });
      expect(await readState(intro.id)).toBe(INTRO_STATES.requested);

      expect(await reply(hanaEmail, replyTo, `no thanks${QUOTED}`)).toMatchObject({ outcome: "posted" });
      expect(await readState(intro.id)).toBe(INTRO_STATES.declined);
    });

    it("never sends the note to an address in the signature", async () => {
      const { hanaEmail, intro, replyTo } = await seedAskedEmail();

      expect(await reply(hanaEmail, replyTo, "Yes\n\nBest,\nHana Helper | hana.work@helperco.example | +1 555 0100")).toMatchObject({ outcome: "posted" });

      expect(await readState(intro.id)).toBe(INTRO_STATES.askingTarget);
      const sent = resend.state.emails.map(({ body }) => body as RecordedBody);
      expect(sent.some(({ to }) => to.includes("hana.work@helperco.example"))).toBe(false);
      const [notice] = await readQueued(EMAIL_KINDS.replyNotice, hanaEmail);
      expect(notice?.text).toContain("Send them this link");
    });

    it("refuses the asker answering their own ask from the connector's email", async () => {
      const { alexEmail, intro, replyTo } = await seedAskedEmail();
      expect(await reply(alexEmail, replyTo, "YES")).toMatchObject({ reason: "wrong_sender" });
      expect(await readState(intro.id)).toBe(INTRO_STATES.requested);
    });
  });

  describe("the intro thread after the joint introduction", () => {
    async function seedJoined() {
      const people = await seedPeople();
      const intro = await seedIntro(people.alex, people.hana, INTRO_STATES.targetAgreed, OUTSIDER_EMAIL);
      await sendJoiningEmail(database, process.env, intro, "Alex Asker");
      await database.update(introRequest).set({ state: INTRO_STATES.completed, targetEmail: null }).where(eq(introRequest.id, intro.id));
      const sent = resend.state.emails.map(({ body }) => body as RecordedBody);
      const toTarget = sent.find(({ to }) => to.includes(OUTSIDER_EMAIL));
      const toAlex = sent.find(({ to }) => to.includes(people.alexEmail));
      return { ...people, intro, sent, toTarget, toAlex };
    }

    it("sends each their own copy, the connector copied, and passes replies to the others while the asker reads them in the app", async () => {
      const { alex, alexEmail, hanaEmail, intro, sent, toTarget, toAlex } = await seedJoined();
      expect(sent).toHaveLength(3);
      // Founderhall's introduction: the asker and the person see each other's address once both said yes.
      expect(toTarget?.text).toContain(alexEmail);
      expect(toTarget?.text).toContain("Reply to this email to write to Alex");
      // Members never see each other's address: the connector's copy shows neither.
      const toConnector = sent.find(({ to }) => to.includes(hanaEmail));
      expect(toConnector?.text).not.toContain(alexEmail);
      expect(toConnector?.text).not.toContain(OUTSIDER_EMAIL);

      expect(await reply(`Jo Rivera <${OUTSIDER_EMAIL}>`, toTarget?.reply_to ?? "", `Lovely to meet you, Alex.${QUOTED}`)).toMatchObject({ kind: "t", outcome: "posted" });
      const toAsker = (await readQueued(EMAIL_KINDS.introThread, alexEmail)).find(({ subject }) => subject.startsWith("Re: "));
      expect(toAsker?.text).toContain("Lovely to meet you, Alex.");

      expect(await reply(alexEmail, toAlex?.reply_to ?? "", `Likewise! Coffee next week?${QUOTED}`)).toMatchObject({ outcome: "posted" });
      const toOutsider = (await readQueued(EMAIL_KINDS.introThread, OUTSIDER_EMAIL)).find(({ subject }) => subject.startsWith("Re: "));
      expect(toOutsider?.text).toContain("Likewise! Coffee next week?");
      expect(toOutsider?.text).not.toContain(alexEmail);

      const thread = await readIntroThreadForRequester(database, intro.id, alex);
      expect(thread?.map(({ author, body }) => [author, body])).toEqual([
        ["target", "Lovely to meet you, Alex."],
        ["requester", "Likewise! Coffee next week?"],
      ]);
    });

    it("refuses the outside person's address used by someone else, and shows the connector the thread they are copied on", async () => {
      const { hana, hanaEmail, intro, toTarget } = await seedJoined();
      expect(await reply(hanaEmail, toTarget?.reply_to ?? "", "Butting in.")).toMatchObject({ reason: "wrong_sender" });
      expect(await database.select().from(introThreadMessage).where(eq(introThreadMessage.introId, intro.id))).toHaveLength(0);
      expect(await readIntroThreadForRequester(database, intro.id, hana)).toEqual([]);
    });
  });

  describe("a helper email", () => {
    it("posts the reply as the helper's answer under the ask", async () => {
      const { hana, hanaEmail, alex, alexEmail, samEmail } = await seedPeople();
      const [created] = await database
        .insert(ask)
        .values({ authorId: alex, title: "Looking for a fintech investor", detail: null, category: "intro" })
        .returning({ id: ask.id });
      const askId = created?.id ?? "";
      await routeAskToHelpers(context(alex, alexEmail), askId, async () => null);
      const [email] = await readQueued(EMAIL_KINDS.askHelper, hanaEmail);
      expect(email?.text).toContain("Or reply to this email: your reply shows under the ask, from you.");

      expect(await reply(samEmail, email?.replyTo ?? "", "Not me.")).toMatchObject({ reason: "wrong_sender" });
      expect(await reply(hanaEmail, email?.replyTo ?? "", `I raised from two fintech funds last year.${QUOTED}`)).toMatchObject({ kind: "h", outcome: "posted" });

      // Resend sends the same reply again: still one answer, and no "already answered" email.
      expect(await reply(hanaEmail, email?.replyTo ?? "", `I raised from two fintech funds last year.${QUOTED}`)).toMatchObject({ outcome: "posted" });

      const answers = await database.select().from(askAnswer).where(eq(askAnswer.askId, askId));
      expect(answers.map(({ authorId, body }) => [authorId, body])).toEqual([[hana, "I raised from two fintech funds last year."]]);
      expect(await readQueued(EMAIL_KINDS.replyNotice, hanaEmail)).toHaveLength(0);
    });
  });

  describe("with no reply domain", () => {
    it("sends no reply address, says to reply in the app, and routes no reply", async () => {
      vi.stubEnv("RESEND_REPLY_DOMAIN", "");
      const { alex, alexEmail, hana, hanaEmail } = await seedPeople();
      const conversationId = await seedConversation(database, alex, hana);
      await sendMessage(context(alex, alexEmail), { conversationId, clientKey: crypto.randomUUID(), body: "Hello" }, mayMessage);

      const [email] = await readQueued(EMAIL_KINDS.directMessage, hanaEmail);
      expect(email?.replyTo).toBeNull();
      expect(email?.text).toContain("Open it in the portal: ");
      expect(email?.text).not.toContain("Reply to this email");
      expect(await reply(hanaEmail, `reply+m${conversationId.replaceAll("-", "")}-00000000000000000000@${REPLY_DOMAIN}`, "Hi")).toMatchObject({ routed: false });
    });

    it("keeps the one joint introduction to both, answered by reply all", async () => {
      vi.stubEnv("RESEND_REPLY_DOMAIN", "");
      const { alex, alexEmail, hana } = await seedPeople();
      const intro = await seedIntro(alex, hana, INTRO_STATES.targetAgreed, OUTSIDER_EMAIL);
      await sendJoiningEmail(database, process.env, intro, "Alex Asker");
      const sent = resend.state.emails.map(({ body }) => body as RecordedBody);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.to).toEqual([OUTSIDER_EMAIL, alexEmail]);
      expect(sent[0]?.text).toContain("Reply all to write to each other.");
    });
  });
});
