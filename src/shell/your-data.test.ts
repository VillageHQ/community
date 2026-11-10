import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as postAdminDelete } from "@/app/api/admin/members/delete/route";
import { POST as postDirectory } from "@/app/api/members/directory/route";
import { POST as postStart } from "@/app/api/messages/start/route";
import { POST as postSend } from "@/app/api/messages/send/route";
import { POST as postIntroAsks } from "@/app/api/onboarding/intro-asks/route";
import { POST as postDelete } from "@/app/api/profile/delete/route";
import { POST as postExport } from "@/app/api/profile/export/route";
import { POST as postPrivacy } from "@/app/api/profile/privacy/route";
import { contentReport } from "@/modules/admin/schema";
import { readPartnerReport } from "@/modules/admin/reads-partner-report";
import { REPORT_TARGETS } from "@/modules/admin/contract";
import { ASK_CATEGORIES, ASK_OUTCOMES } from "@/modules/asks/contract";
import { ask, askAnswer, askOffer, askTally } from "@/modules/asks/schema";
import { reaction } from "@/modules/feed/schema";
import { INTRO_STATES } from "@/modules/intros/contract";
import { introRequest } from "@/modules/intros/schema";
import { directorySchema, ONBOARDING_STEPS } from "@/modules/members/contract-profile";
import { DELETED_MEMBER_NAME, MESSAGE_POLICIES } from "@/modules/members/contract-privacy";
import { invite, memberAvatar, memberFillIn, memberLookup, memberNetwork, memberPrivacy, memberProfile, memberRemoval, memberTag } from "@/modules/members/schema";
import { conversation, directMessage, messageReport } from "@/modules/messages/schema";
import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { adminAuditEntry } from "@/platform/audit/schema";
import { account, rateLimit, session, user } from "@/platform/database/auth-schema";
import { emailOutbox } from "@/platform/email/schema";
import { saveVillageGroup } from "@/modules/network/service-settings";
import { saveVillageKeys } from "@/platform/village/settings";
import { weeklyEmail } from "@/platform/weekly-email/schema";
import { resolveOnboardingStep } from "@/shell/onboarding";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { seedComment, seedPost } from "@/test/feed";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { joinMemberToGroup, nameMember } from "@/test/intros";
import { seedConversation, seedMessages } from "@/test/messages";
import { createSignedInMember } from "@/test/signed-in-member";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const UNPROCESSABLE_STATUS = 422;
const WEEK_MS = 7 * 86_400_000;

const DANA = { name: "Dana Erasewell", slug: "dana-erasewell" };
// Words only Dana wrote, one per place they can be stored.
const DANA_WORDS = {
  bio: "DANABIO builds freight software",
  post: "DANAPOST first post",
  reply: "DANAREPLY on Omar's post",
  askTitle: "DANAASK need a freight CFO",
  answer: "DANAANSWER try the logistics guild",
  offer: "DANAOFFER happy to help",
  message: "DANAMSG lunch on Friday?",
  introNote: "DANANOTE please introduce me",
  declineNote: "DANADECLINE not a good fit",
};
const OMAR_WORDS = { message: "OMARMSG sure, Friday works", offerToDana: "OMAROFFER I know a CFO", introNote: "OMARNOTE please ask Tara" };

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;

function call(handler: Handler, member: Member, body: unknown) {
  return handler(
    new Request(`${APP_URL}/api/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
      body: JSON.stringify(body),
    }),
  );
}

type Trace = { table: string; column: string; needle: string };

// The proof the brief asks for: every text, varchar, jsonb and array column of every table, searched for each needle.
async function findTraces(database: ReturnType<typeof createTestDatabase>, needles: readonly string[]): Promise<Trace[]> {
  const columns = await database.execute<{ table_name: string; column_name: string; data_type: string }>(sql`
    select c.table_name, c.column_name, c.data_type from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.data_type in ('text', 'character varying', 'jsonb', 'ARRAY')`);
  const traces: Trace[] = [];
  for (const { table_name: table, column_name: column, data_type: type } of columns.rows) {
    const haystack = type === "text" || type === "character varying" ? sql.identifier(column) : sql`${sql.identifier(column)}::text`;
    for (const needle of needles) {
      const found = await database.execute(sql`select 1 from ${sql.identifier(table)} where ${haystack} ilike ${`%${needle}%`} limit 1`);
      if (found.rows.length > 0) traces.push({ table, column, needle });
    }
  }
  return traces;
}

function readIntroNumbers(report: Awaited<ReturnType<typeof readPartnerReport>>) {
  const sinceLaunch = report.intros?.periods.sinceLaunch;
  if (!sinceLaunch) throw new Error("The report has no intro numbers.");
  const { connectors, ...counts } = sinceLaunch;
  return { counts, totalIntroduced: connectors.others.introduced + connectors.named.reduce((total, row) => total + row.introduced, 0) };
}

describe("your data and the real delete", () => {
  const database = createTestDatabase();
  let village: Awaited<ReturnType<typeof startFakeVillageServer>>;
  let dana: Member;
  let omar: Member;
  let admin: Member;

  beforeAll(async () => {
    village = await startFakeVillageServer();
    process.env.VILLAGE_API_URL = village.url;
  });

  afterAll(async () => {
    delete process.env.VILLAGE_API_URL;
    await village.stop();
    await clearDatabase(database);
    await database.$client.end();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    village.reset();
    admin = await createSignedInMember(database, "admin");
    dana = await createSignedInMember(database);
    omar = await createSignedInMember(database);
    await nameMember(database, admin.userId, "Ada Admin");
    await nameMember(database, dana.userId, DANA.name);
    await nameMember(database, omar.userId, "Omar Keeper");
  });

  // Dana everywhere a member can leave a trace.
  async function seedDanaEverywhere() {
    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    await saveVillageGroup(database, { id: "group-1", inviteLink: "https://village.test/join/x" });
    const externalId = await joinMemberToGroup(database, dana.userId, DANA.slug);
    village.state.linkedMembers.set(externalId, { status: "ready", email: dana.email });
    await database.update(memberNetwork).set({ linkedinConfirmedSlug: DANA.slug, villageLinkedAt: new Date() }).where(eq(memberNetwork.userId, dana.userId));
    await joinMemberToGroup(database, omar.userId, "omar-keeper");

    await database.insert(memberProfile).values({ userId: dana.userId, bio: DANA_WORDS.bio, title: "Founder", onboardingCompletedAt: new Date() });
    await database.insert(memberTag).values({ userId: dana.userId, tag: "Erasewell Freight", normalizedTag: "erasewell freight" });
    await database.insert(memberAvatar).values({ userId: dana.userId, bytes: Buffer.from([1, 2, 3]), contentType: "image/png", updatedAt: new Date() });
    await database.insert(memberLookup).values({ userId: dana.userId, consentedAt: new Date(), status: "found", lookedUpAt: new Date(), linkedinUrl: `https://www.linkedin.com/in/${DANA.slug}` });
    await database.insert(memberFillIn).values({ userId: dana.userId, field: "headline", value: "Founder at Erasewell Freight", filledAt: new Date() });
    await database.insert(invite).values({
      email: dana.email,
      tokenHash: randomUUID(),
      invitedByName: "Ada Admin",
      inviteeName: DANA.name,
      expiresAt: new Date(Date.now() + WEEK_MS),
      acceptedAt: new Date(),
      acceptedUserId: dana.userId,
    });

    const danaPost = await seedPost(database, { authorId: dana.userId, body: DANA_WORDS.post });
    await seedComment(database, { postId: danaPost, authorId: omar.userId, body: "Omar's reply under Dana's post" });
    const omarPost = await seedPost(database, { authorId: omar.userId, body: "Omar's own post" });
    await seedComment(database, { postId: omarPost, authorId: dana.userId, body: DANA_WORDS.reply });
    await database.insert(reaction).values({ postId: omarPost, userId: dana.userId, reaction: "heart" });

    const [danaAsk] = await database
      .insert(ask)
      .values({ authorId: dana.userId, title: DANA_WORDS.askTitle, category: ASK_CATEGORIES.hire, closedAt: new Date(), outcome: ASK_OUTCOMES.solvedHere })
      .returning({ id: ask.id });
    const [omarAsk] = await database.insert(ask).values({ authorId: omar.userId, title: "Omar needs a designer", category: ASK_CATEGORIES.advice }).returning({ id: ask.id });
    if (!danaAsk || !omarAsk) throw new Error("The asks are missing.");
    await database.insert(askOffer).values({ askId: danaAsk.id, helperId: omar.userId, note: OMAR_WORDS.offerToDana });
    await database.insert(askOffer).values({ askId: omarAsk.id, helperId: dana.userId, note: DANA_WORDS.offer });
    await database.insert(askAnswer).values({ askId: omarAsk.id, authorId: dana.userId, body: DANA_WORDS.answer });

    const intro = {
      targetName: "Tara Target",
      targetLinkedinSlug: "tara-target",
      reason: "Worked together",
      expiresAt: new Date(Date.now() + WEEK_MS),
    };
    // Dana asked Omar, and it was made. Omar asked Dana, still open. Omar asked Dana another time, and Dana declined.
    await database.insert(introRequest).values({
      ...intro,
      requesterId: dana.userId,
      introducerId: omar.userId,
      introducerName: "Omar Keeper",
      introducerLinkedinSlug: "omar-keeper",
      note: DANA_WORDS.introNote,
      state: INTRO_STATES.completed,
      acceptedAt: new Date(),
      askedTargetAt: new Date(),
      targetAgreedAt: new Date(),
      closedAt: new Date(),
    });
    await database.insert(introRequest).values({
      ...intro,
      requesterId: omar.userId,
      introducerId: dana.userId,
      introducerName: DANA.name,
      introducerLinkedinSlug: DANA.slug,
      reason: `${DANA.name} worked with Tara`,
      note: OMAR_WORDS.introNote,
    });
    await database.insert(introRequest).values({
      ...intro,
      targetLinkedinSlug: "tara-other",
      requesterId: omar.userId,
      introducerId: dana.userId,
      introducerName: DANA.name,
      introducerLinkedinSlug: DANA.slug,
      note: OMAR_WORDS.introNote,
      state: INTRO_STATES.declined,
      declineReason: DANA_WORDS.declineNote,
      closedAt: new Date(),
    });

    const conversationId = await seedConversation(database, dana.userId, omar.userId);
    await seedMessages(database, { conversationId, senderId: omar.userId, count: 1 });
    await database.update(directMessage).set({ body: OMAR_WORDS.message }).where(eq(directMessage.senderId, omar.userId));
    await seedMessages(database, { conversationId, senderId: dana.userId, count: 1 });
    await database.update(directMessage).set({ body: DANA_WORDS.message }).where(eq(directMessage.senderId, dana.userId));
    const [danaMessage] = await database.select({ id: directMessage.id }).from(directMessage).where(eq(directMessage.senderId, dana.userId));

    await database.insert(messageReport).values({
      messageId: danaMessage?.id,
      reporterId: omar.userId,
      reportedMemberId: dana.userId,
      messageBody: DANA_WORDS.message,
      messageSentAt: new Date(),
    });
    await database.insert(contentReport).values({
      targetType: REPORT_TARGETS.post,
      targetId: danaPost,
      reporterId: omar.userId,
      reportedMemberId: dana.userId,
      body: DANA_WORDS.post,
      contentCreatedAt: new Date(),
    });
    await database.insert(adminAuditEntry).values([
      { action: AUDIT_ACTIONS.inviteCreated, actorId: admin.userId, actorName: "Ada Admin", targetName: DANA.name, detail: dana.email },
      { action: AUDIT_ACTIONS.emailConfirmed, actorId: admin.userId, actorName: "Ada Admin", targetMemberId: dana.userId, targetName: DANA.name },
    ]);
    await database.insert(emailOutbox).values([
      { kind: "intro_asked", toEmail: dana.email, memberId: dana.userId, subject: "Omar asked you", html: "<p>hi</p>", text: "hi", status: "sent" },
      { kind: "message", toEmail: omar.email, memberId: omar.userId, subject: `${DANA.name} sent you a message`, html: "<p>x</p>", text: "x", status: "sent" },
      { kind: "message", toEmail: omar.email, memberId: omar.userId, subject: "An unrelated email", html: "<p>keep</p>", text: "keep", status: "sent" },
    ]);
    await database.insert(weeklyEmail).values([
      { memberId: dana.userId, weekKey: "2026-W45", status: "queued", items: [{ number: 1, kind: "ask", ref: omarAsk.id, title: "Omar needs a designer" }] },
      { memberId: omar.userId, weekKey: "2026-W45", status: "queued", items: [{ number: 1, kind: "ask", ref: danaAsk.id, title: DANA_WORDS.askTitle }] },
    ]);
    await database.insert(rateLimit).values({ id: randomUUID(), key: `feed-post|${dana.userId}`, count: 1, lastRequest: Date.now() });
    await database.insert(memberPrivacy).values({ userId: dana.userId, messagePolicy: MESSAGE_POLICIES.introduced });
    return { externalId, danaPost, omarPost, conversationId };
  }

  const danaNeedles = () => [dana.email, DANA.name, "Erasewell", DANA.slug, ...Object.values(DANA_WORDS)];

  describe("deleting your own account", () => {
    it("leaves no email, name or words of theirs in any table, keeps the partner report's numbers, and asks Village to remove them", async () => {
      const { externalId, conversationId } = await seedDanaEverywhere();
      const before = await readPartnerReport(database);
      expect((await findTraces(database, danaNeedles())).length).toBeGreaterThan(10);

      const response = await call(postDelete, dana, { confirmation: "Delete" });
      expect(response.status).toBe(OK_STATUS);
      const { message, isVillageIncomplete } = (await response.json()) as { message: string; isVillageIncomplete: boolean };
      expect(isVillageIncomplete).toBe(false);
      expect(message).toContain("Village was asked to remove the account there too");

      expect(await findTraces(database, danaNeedles())).toEqual([]);

      // Village: they left the group, then their Village user was cancelled with their own token.
      expect(village.state.leftMembers.has(externalId)).toBe(true);
      expect(village.state.cancelledMembers.has(externalId)).toBe(true);
      expect(village.readRequests("/v2/user/cancel")[0]?.headers.authorization).toContain(externalId);

      // The partner report: every intro still counts. The one still open is now withdrawn.
      const after = await readPartnerReport(database);
      const beforeIntros = readIntroNumbers(before);
      const afterIntros = readIntroNumbers(after);
      expect(afterIntros.counts.asked).toBe(beforeIntros.counts.asked);
      expect(afterIntros.counts.introduced).toBe(beforeIntros.counts.introduced);
      expect(afterIntros.counts.declined).toBe(beforeIntros.counts.declined);
      expect(afterIntros.counts.connectorSaidYes).toBe(beforeIntros.counts.connectorSaidYes);
      expect(afterIntros.totalIntroduced).toBe(beforeIntros.totalIntroduced);
      expect(afterIntros.counts.open).toBe(beforeIntros.counts.open - 1);
      expect(afterIntros.counts.withdrawn).toBe(beforeIntros.counts.withdrawn + 1);
      expect(after.needs).toEqual(before.needs);
      expect(await database.select().from(askTally)).toHaveLength(1);

      // They can't sign in: no password, no session, a banned placeholder with no email of theirs.
      expect(await database.select().from(account).where(eq(account.userId, dana.userId))).toEqual([]);
      expect(await database.select().from(session).where(eq(session.userId, dana.userId))).toEqual([]);
      const [placeholder] = await database.select().from(user).where(eq(user.id, dana.userId));
      expect(placeholder).toMatchObject({ name: DELETED_MEMBER_NAME, banned: true, image: null });
      expect((await call(postExport, dana, {})).status).toBe(UNAUTHORIZED_STATUS);
      const [removal] = await database.select().from(memberRemoval).where(eq(memberRemoval.userId, dana.userId));
      expect(removal?.erasedAt).not.toBeNull();
      expect(removal?.villageCancelOutcome).toBe("cancelled");

      // The other member keeps the conversation and their own words; Dana's message shows as deleted.
      const thread = await database.select().from(directMessage).where(eq(directMessage.conversationId, conversationId));
      expect(thread.find(({ senderId }) => senderId === omar.userId)?.body).toBe(OMAR_WORDS.message);
      expect(thread.find(({ senderId }) => senderId === dana.userId)).toMatchObject({ body: null });
      expect(thread.find(({ senderId }) => senderId === dana.userId)?.deletedAt).not.toBeNull();
      const [kept] = await database.select().from(conversation).where(eq(conversation.id, conversationId));
      expect(kept).toBeDefined();

      // The unrelated email to Omar stays; the one naming Dana is gone.
      expect((await database.select().from(emailOutbox)).map(({ subject }) => subject)).toEqual(["An unrelated email"]);
      // Omar's weekly email keeps its numbered item, without Dana's words.
      const [omarWeekly] = await database.select().from(weeklyEmail).where(eq(weeklyEmail.memberId, omar.userId));
      expect(omarWeekly?.items).toEqual([expect.objectContaining({ number: 1, title: "(deleted)" })]);

      const [entry] = await database.select().from(adminAuditEntry).where(eq(adminAuditEntry.action, AUDIT_ACTIONS.accountDeleted));
      expect(entry).toMatchObject({ actorName: DELETED_MEMBER_NAME, targetName: DELETED_MEMBER_NAME, detail: "self|cancelled" });
    });

    it("needs the word typed, and deletes nothing without it", async () => {
      expect((await call(postDelete, dana, { confirmation: "yes" })).status).toBe(UNPROCESSABLE_STATUS);
      expect((await call(postDelete, dana, {})).status).toBe(UNPROCESSABLE_STATUS);
      const [still] = await database.select().from(user).where(eq(user.id, dana.userId));
      expect(still?.name).toBe(DANA.name);
    });

    it("still deletes everything here when Village can't be reached, and says what is left to do", async () => {
      await seedDanaEverywhere();
      process.env.VILLAGE_API_URL = "http://127.0.0.1:9";
      try {
        const response = await call(postDelete, dana, { confirmation: "delete" });
        expect(response.status).toBe(OK_STATUS);
        const body = (await response.json()) as { message: string; isVillageIncomplete: boolean };
        expect(body.isVillageIncomplete).toBe(true);
        expect(body.message).toContain("Village's removal form");
      } finally {
        process.env.VILLAGE_API_URL = village.url;
      }
      expect(await findTraces(database, danaNeedles())).toEqual([]);
    });

    it("refuses to delete the only admin", async () => {
      const response = await call(postDelete, admin, { confirmation: "delete" });
      expect(response.status).toBe(409);
      const [still] = await database.select().from(user).where(eq(user.id, admin.userId));
      expect(still?.name).toBe("Ada Admin");
    });
  });

  describe("an admin deleting a member from Manage", () => {
    it("runs the same delete", async () => {
      await seedDanaEverywhere();
      const response = await call(postAdminDelete, admin, { memberId: dana.userId, confirmation: "delete" });
      expect(response.status).toBe(OK_STATUS);
      expect(await findTraces(database, danaNeedles())).toEqual([]);
      const [entry] = await database.select().from(adminAuditEntry).where(eq(adminAuditEntry.action, AUDIT_ACTIONS.accountDeleted));
      expect(entry).toMatchObject({ actorName: "Ada Admin", detail: "admin|cancelled" });
    });

    it("is for admins only", async () => {
      const response = await call(postAdminDelete, omar, { memberId: dana.userId, confirmation: "delete" });
      expect(response.status).toBe(FORBIDDEN_STATUS);
      const [still] = await database.select().from(user).where(eq(user.id, dana.userId));
      expect(still?.name).toBe(DANA.name);
    });
  });

  describe("the export", () => {
    it("holds the member's own data and nothing private of anyone else", async () => {
      await seedDanaEverywhere();
      const response = await call(postExport, dana, {});
      expect(response.status).toBe(OK_STATUS);
      expect(response.headers.get("content-disposition")).toMatch(/attachment; filename="my-data-\d{4}-\d{2}-\d{2}\.json"/);
      const text = await response.text();
      for (const words of [dana.email, DANA.name, DANA_WORDS.bio, DANA_WORDS.post, DANA_WORDS.reply, DANA_WORDS.askTitle, DANA_WORDS.answer, DANA_WORDS.offer, DANA_WORDS.message, DANA_WORDS.introNote, DANA_WORDS.declineNote]) {
        expect(text).toContain(words);
      }
      // Omar's private words: his message to Dana, his offer note on her ask, his intro notes to her, and his email.
      for (const words of [OMAR_WORDS.message, OMAR_WORDS.offerToDana, OMAR_WORDS.introNote, omar.email, admin.email]) expect(text).not.toContain(words);
      const exported = JSON.parse(text) as { privacy: { whoCanMessageMe: string }; intros: unknown[] };
      expect(exported.privacy.whoCanMessageMe).toBe(MESSAGE_POLICIES.introduced);
      expect(exported.intros).toHaveLength(3);
    });
  });

  describe("hide me from the directory", () => {
    it("removes them from the directory and its search, and shows them again when switched off", async () => {
      const search = async () => directorySchema.parse(await (await call(postDirectory, omar, { search: "Erasewell", tag: "", page: 1 })).json());
      expect((await search()).members.map(({ id }) => id)).toContain(dana.userId);

      expect((await call(postPrivacy, dana, { isHidden: true })).status).toBe(OK_STATUS);
      expect((await search()).members).toEqual([]);
      const listed = directorySchema.parse(await (await call(postDirectory, omar, { search: "", tag: "", page: 1 })).json());
      expect(listed.members.map(({ id }) => id)).not.toContain(dana.userId);

      await call(postPrivacy, dana, { isHidden: false });
      expect((await search()).members.map(({ id }) => id)).toContain(dana.userId);
    });
  });

  describe("who can message me", () => {
    it("blocks a sender they weren't introduced to, and lets an introduced one, an admin and a reply through", async () => {
      const stranger = await createSignedInMember(database);
      await call(postPrivacy, dana, { messagePolicy: MESSAGE_POLICIES.introduced });

      const refused = await call(postStart, stranger, { memberId: dana.userId });
      expect(refused.status).toBe(FORBIDDEN_STATUS);
      expect(((await refused.json()) as { message: string }).message).toContain("introduced");

      await database.insert(introRequest).values({
        requesterId: omar.userId,
        introducerId: dana.userId,
        targetName: "Tara Target",
        targetLinkedinSlug: "tara-target",
        introducerName: DANA.name,
        introducerLinkedinSlug: DANA.slug,
        reason: "Worked together",
        note: "A note",
        state: INTRO_STATES.completed,
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + WEEK_MS),
        closedAt: new Date(),
      });
      expect((await call(postStart, omar, { memberId: dana.userId })).status).toBe(OK_STATUS);
      expect((await call(postStart, admin, { memberId: dana.userId })).status).toBe(OK_STATUS);

      // Once Dana writes to the stranger, the stranger can answer.
      const started = (await (await call(postStart, dana, { memberId: stranger.userId })).json()) as { conversationId: string };
      expect((await call(postSend, dana, { conversationId: started.conversationId, clientKey: randomUUID(), body: "Hello there" })).status).toBe(OK_STATUS);
      expect((await call(postSend, stranger, { conversationId: started.conversationId, clientKey: randomUUID(), body: "Hi back" })).status).toBe(OK_STATUS);
    });

    it("stops a message in a conversation that already existed when the policy changes", async () => {
      const stranger = await createSignedInMember(database);
      const conversationId = await seedConversation(database, dana.userId, stranger.userId);
      await call(postPrivacy, dana, { messagePolicy: MESSAGE_POLICIES.introduced });
      expect((await call(postSend, stranger, { conversationId, clientKey: randomUUID(), body: "Hello" })).status).toBe(FORBIDDEN_STATUS);
    });
  });

  describe("accept intro asks", () => {
    it("is a required step in onboarding, saved with its date and place", async () => {
      await database.insert(memberProfile).values({ userId: omar.userId, cardStepDoneAt: new Date() });
      const omarSession = { id: omar.userId, email: omar.email, role: "user" };
      expect(await resolveOnboardingStep(database, omarSession)).toBe(ONBOARDING_STEPS.introAsks);

      expect((await call(postIntroAsks, omar, {})).status).toBe(UNPROCESSABLE_STATUS);
      expect((await call(postIntroAsks, omar, { acceptsIntroAsks: false })).status).toBe(OK_STATUS);
      expect(await resolveOnboardingStep(database, omarSession)).not.toBe(ONBOARDING_STEPS.introAsks);

      const [saved] = await database.select().from(memberPrivacy).where(eq(memberPrivacy.userId, omar.userId));
      expect(saved).toMatchObject({ acceptsIntroAsks: false, introAsksAnsweredPlace: "onboarding" });
      expect(saved?.introAsksAnsweredAt).toBeInstanceOf(Date);
      const [entry] = await database.select().from(adminAuditEntry).where(eq(adminAuditEntry.action, AUDIT_ACTIONS.introAsksAnswered));
      expect(entry).toMatchObject({ actorId: omar.userId, detail: "no" });
    });

    it("can be changed on Your data", async () => {
      expect((await call(postPrivacy, dana, { acceptsIntroAsks: true })).status).toBe(OK_STATUS);
      const [saved] = await database.select().from(memberPrivacy).where(eq(memberPrivacy.userId, dana.userId));
      expect(saved).toMatchObject({ acceptsIntroAsks: true, introAsksAnsweredPlace: "your_data" });
    });
  });
});
