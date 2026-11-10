import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postCsv } from "@/app/api/admin/partner-report/csv/route";
import { POST as postPreview } from "@/app/api/admin/partner-report/preview/route";
import { POST as postSend } from "@/app/api/admin/partner-report/send/route";
import { POST as postShared } from "@/app/api/admin/partner-report/shared/route";
import { POST as postReportCredit } from "@/app/api/profile/report-credit/route";
import { REPORT_PERIOD_KEYS } from "@/modules/admin/contract-partner-report";
import { renderPartnerReportCsv } from "@/modules/admin/partner-report-rows";
import { readPartnerReport, readPartnerReportSettings, readReportPeriods } from "@/modules/admin/reads-partner-report";
import { ask } from "@/modules/asks/schema";
import { asksManifest } from "@/modules/asks/manifest";
import { ASK_CATEGORIES, ASK_OUTCOMES } from "@/modules/asks/contract";
import { INTRO_OUTCOMES, INTRO_RESULTS, INTRO_STATES } from "@/modules/intros/contract";
import { introRequest } from "@/modules/intros/schema";
import { memberProfile } from "@/modules/members/schema";
import { readReportCredit } from "@/modules/members/service-report-credit";
import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { adminAuditEntry } from "@/platform/audit/schema";
import { user } from "@/platform/database/auth-schema";
import { EMAIL_KINDS } from "@/platform/email/kinds";
import { emailOutbox, emailSuppression } from "@/platform/email/schema";
import { saveModuleState } from "@/platform/modules/enablement";
import { readSetupProgress, SETUP_STEPS } from "@/shell/admin-setup";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY } from "@/test/fake-resend-server";
import { joinMemberToGroup, nameMember } from "@/test/intros";
import { createSignedInMember } from "@/test/signed-in-member";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const FORBIDDEN_STATUS = 403;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const DAY_MS = 86_400_000;
const NOTE = "A private note about freight pricing.";
const ASKER_NAME = "Asker Ada";
const TARGET_NAME = "Target Tess";
const CREDITED_NAME = "Credited Connie";
const QUIET_NAME = "Quiet Quinn";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;
type IntroSeed = Partial<typeof introRequest.$inferInsert>;

function call(handler: Handler, member: Member, body: unknown) {
  return handler(
    new Request(`${APP_URL}/api/admin/partner-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
      body: JSON.stringify(body),
    }),
  );
}

function plusDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

describe("the partner report", () => {
  const database = createTestDatabase();
  let admin: Member;
  let asker: Member;
  let credited: Member;
  let quiet: Member;

  async function seedIntro(introducer: Member, seed: IntroSeed) {
    await database.insert(introRequest).values({
      requesterId: asker.userId,
      introducerId: introducer.userId,
      targetLinkedinSlug: `target-${crypto.randomUUID()}`,
      targetName: TARGET_NAME,
      introducerName: introducer === credited ? CREDITED_NAME : QUIET_NAME,
      introducerLinkedinSlug: introducer === credited ? "connie" : "quinn",
      reason: "Worked together",
      note: NOTE,
      expiresAt: plusDays(new Date(), 7),
      ...seed,
    });
  }

  // An intro in every state, in three periods. The expected numbers below are counted by hand from this list.
  async function seedEveryState() {
    const now = new Date();
    const periods = readReportPeriods(now);
    const thisQuarter = new Date(periods.thisQuarter.from!.getTime() + 60_000);
    const lastQuarter = plusDays(periods.thisQuarter.from!, -10);
    const yearAgo = plusDays(periods.lastQuarter.from!, -200);
    const made = (createdAt: Date, days: number): IntroSeed => ({
      state: INTRO_STATES.completed,
      createdAt,
      askedTargetAt: createdAt,
      targetAgreedAt: createdAt,
      closedAt: plusDays(createdAt, days),
    });

    // This quarter: 12 asked, plus one withheld ask that never reached its connector.
    await seedIntro(quiet, { createdAt: thisQuarter });
    await seedIntro(credited, { createdAt: thisQuarter, state: INTRO_STATES.askingTarget, askedTargetAt: thisQuarter });
    await seedIntro(credited, { createdAt: thisQuarter, state: INTRO_STATES.targetAgreed, askedTargetAt: thisQuarter, targetAgreedAt: thisQuarter });
    await seedIntro(credited, { ...made(thisQuarter, 2), outcome: INTRO_OUTCOMES.helped, outcomeResults: [INTRO_RESULTS.customer, INTRO_RESULTS.hire] });
    await seedIntro(quiet, { ...made(thisQuarter, 4), outcome: INTRO_OUTCOMES.notHelped });
    await seedIntro(credited, { ...made(thisQuarter, 6), outcome: INTRO_OUTCOMES.notYet });
    await seedIntro(quiet, { createdAt: thisQuarter, state: INTRO_STATES.declined, closedAt: thisQuarter });
    await seedIntro(credited, { createdAt: thisQuarter, state: INTRO_STATES.targetDeclined, askedTargetAt: thisQuarter, closedAt: thisQuarter });
    await seedIntro(quiet, { createdAt: thisQuarter, state: INTRO_STATES.expired, closedAt: thisQuarter });
    await seedIntro(credited, { createdAt: thisQuarter, state: INTRO_STATES.expired, askedTargetAt: thisQuarter, closedAt: thisQuarter });
    await seedIntro(quiet, { createdAt: thisQuarter, expiresAt: plusDays(now, -1) });
    await seedIntro(quiet, { createdAt: thisQuarter, state: INTRO_STATES.withdrawn, closedAt: thisQuarter });
    await seedIntro(quiet, { createdAt: thisQuarter, isWithheld: true });

    // Last quarter: one made and one declined. A year ago: one expired.
    await seedIntro(quiet, { ...made(lastQuarter, 1), outcome: INTRO_OUTCOMES.helped });
    await seedIntro(credited, { createdAt: lastQuarter, state: INTRO_STATES.declined, closedAt: lastQuarter });
    await seedIntro(quiet, { createdAt: yearAgo, state: INTRO_STATES.expired, closedAt: yearAgo });
  }

  beforeEach(async () => {
    await clearDatabase(database);
    admin = await createSignedInMember(database, "admin");
    asker = await createSignedInMember(database);
    credited = await createSignedInMember(database);
    quiet = await createSignedInMember(database);
    await nameMember(database, asker.userId, ASKER_NAME);
    await nameMember(database, credited.userId, CREDITED_NAME);
    await nameMember(database, quiet.userId, QUIET_NAME);
    await joinMemberToGroup(database, asker.userId, "ada");
    await joinMemberToGroup(database, credited.userId, "connie");
    await joinMemberToGroup(database, quiet.userId, "quinn");
    await call(postReportCredit, credited, { isOn: true });
    await seedEveryState();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await database.$client.end();
  });

  describe("the numbers", () => {
    it("match the seeded intros in every state, per period", async () => {
      const { intros } = await readPartnerReport(database);

      expect(intros?.periods[REPORT_PERIOD_KEYS.thisQuarter]).toMatchObject({
        asked: 12,
        connectorSaidYes: 7,
        targetSaidYes: 4,
        introduced: 3,
        declined: 2,
        declinedByConnector: 1,
        declinedByTarget: 1,
        expired: 3,
        expiredAtConnector: 2,
        expiredAtTarget: 1,
        expiredBeforeIntro: 0,
        withdrawn: 1,
        open: 3,
        helped: 1,
        notHelped: 1,
        notYet: 1,
        unanswered: 0,
        helpedPercent: 50,
        results: { customer: 1, hire: 1, investor: 0 },
        medianDaysToIntroduced: 4,
      });
      expect(intros?.periods[REPORT_PERIOD_KEYS.lastQuarter]).toMatchObject({ asked: 2, introduced: 1, declined: 1, expired: 0, open: 0, helped: 1, helpedPercent: 100, medianDaysToIntroduced: 1 });
      expect(intros?.periods[REPORT_PERIOD_KEYS.sinceLaunch]).toMatchObject({ asked: 15, introduced: 4, declined: 3, expired: 4, withdrawn: 1, open: 3, helped: 2, notHelped: 1, helpedPercent: 67 });
    });

    it("never counts an expiry as a decline, and every period adds up", async () => {
      const { intros } = await readPartnerReport(database);

      for (const period of Object.values(intros?.periods ?? {})) {
        expect(period.declined).toBe(period.declinedByConnector + period.declinedByTarget);
        expect(period.asked).toBe(period.introduced + period.declined + period.expired + period.withdrawn + period.open);
      }
      const declinedRows = await database.select({ id: introRequest.id }).from(introRequest).where(inArray(introRequest.state, [INTRO_STATES.declined, INTRO_STATES.targetDeclined]));
      expect(intros?.periods[REPORT_PERIOD_KEYS.sinceLaunch].declined).toBe(declinedRows.length);
    });

    it("puts an ask that expired after both said yes on its own line, not on the person's", async () => {
      await seedIntro(credited, { state: INTRO_STATES.expired, askedTargetAt: new Date(), targetAgreedAt: new Date(), closedAt: new Date() });

      const { intros } = await readPartnerReport(database);

      expect(intros?.periods[REPORT_PERIOD_KEYS.thisQuarter]).toMatchObject({ expired: 4, expiredAtTarget: 1, expiredBeforeIntro: 1 });
    });

    it("expires a due ask before counting, so it isn't counted as open", async () => {
      await readPartnerReport(database);

      const open = await database.select({ id: introRequest.id }).from(introRequest).where(eq(introRequest.state, INTRO_STATES.requested));
      expect(open).toHaveLength(2);
    });

    it("adds intros and members by cohort only once members have a cohort", async () => {
      expect(renderPartnerReportCsv(await readPartnerReport(database))).not.toContain("cohort");

      await database.insert(memberProfile).values({ userId: asker.userId, cohort: "Fund II" }).onConflictDoUpdate({ target: memberProfile.userId, set: { cohort: "Fund II" } });
      await database.insert(memberProfile).values({ userId: credited.userId, cohort: " fund ii" }).onConflictDoUpdate({ target: memberProfile.userId, set: { cohort: " fund ii" } });
      const report = await readPartnerReport(database);

      expect(report.intros?.periods[REPORT_PERIOD_KEYS.thisQuarter].byCohort).toEqual([{ key: "fund ii", label: expect.stringMatching(/^fund ii$/i), asked: 12, introduced: 3 }]);
      expect(report.intros?.periods[REPORT_PERIOD_KEYS.sinceLaunch].byCohort).toMatchObject([{ asked: 15, introduced: 4 }]);
      expect(report.community.cohortMembers).toMatchObject([{ key: "fund ii", members: 2 }]);
      const csv = renderPartnerReportCsv(report);
      expect(csv).toMatch(/Intros by cohort,Fund II: asked for,12,2,15/i);
      expect(csv).toMatch(/Intros by cohort,Fund II: introduced,3,1,4/i);
      expect(csv).toMatch(/Community,Members in Fund II,2/i);
      expect(csv).not.toContain(ASKER_NAME);
    });

    it("breaks asks down by need when the Asks board is on", async () => {
      await saveModuleState(database, asksManifest, true);
      await database.insert(ask).values([
        { authorId: asker.userId, title: "A designer", category: ASK_CATEGORIES.hire, closedAt: new Date(), outcome: ASK_OUTCOMES.solvedHere },
        { authorId: asker.userId, title: "A buyer", category: ASK_CATEGORIES.customer },
      ]);

      const { needs } = await readPartnerReport(database);

      expect(needs?.[REPORT_PERIOD_KEYS.sinceLaunch].find(({ category }) => category === ASK_CATEGORIES.hire)).toEqual({ category: ASK_CATEGORIES.hire, posted: 1, solvedHere: 1 });
      expect(renderPartnerReportCsv(await readPartnerReport(database))).toContain("Asks by need,Hires: solved here,1,0,1");
      expect(renderPartnerReportCsv(await readPartnerReport(database))).not.toContain("A designer");
    });
  });

  describe("privacy", () => {
    async function readEverything() {
      const csv = await (await call(postCsv, admin, {})).text();
      const preview = await (await call(postPreview, admin, { note: "" })).text();
      return { csv, preview, report: JSON.stringify(await readPartnerReport(database)) };
    }

    it("names no asker, target or note anywhere, and names the credited connector", async () => {
      const { csv, preview, report } = await readEverything();

      for (const text of [csv, preview, report]) {
        expect(text).not.toContain(ASKER_NAME);
        expect(text).not.toContain(TARGET_NAME);
        expect(text).not.toContain(NOTE);
        expect(text).not.toContain(QUIET_NAME);
        expect(text).not.toContain(asker.userId);
        expect(text).toContain(CREDITED_NAME);
      }
      expect(csv).toContain(`Top connectors,${CREDITED_NAME},2,0,2`);
      expect(csv).toContain("Top connectors,\"Other connectors, not named\",1,1,1");
    });

    it("stops naming a connector who turns credit off", async () => {
      await call(postReportCredit, credited, { isOn: false });

      const { csv, preview } = await readEverything();

      expect(csv).not.toContain(CREDITED_NAME);
      expect(preview).not.toContain(CREDITED_NAME);
      expect(csv).toContain("Top connectors,\"Other connectors, not named\",2,1,2");
    });

    it("doesn't name a credited connector who was removed", async () => {
      await database.update(user).set({ banned: true }).where(eq(user.id, credited.userId));

      expect(renderPartnerReportCsv(await readPartnerReport(database))).not.toContain(CREDITED_NAME);
    });

    it("names at most five, counts the rest, and keeps two people with one name apart", async () => {
      const extras = await Promise.all(Array.from({ length: 6 }, () => createSignedInMember(database)));
      for (const [index, extra] of extras.entries()) {
        await nameMember(database, extra.userId, index < 2 ? "Same Name" : `Extra ${index}`);
        await call(postReportCredit, extra, { isOn: true });
        for (let made = 0; made < (index < 2 ? 4 : 3); made += 1) {
          await seedIntro(extra, { state: INTRO_STATES.completed, askedTargetAt: new Date(), targetAgreedAt: new Date(), closedAt: new Date() });
        }
      }

      const report = await readPartnerReport(database);
      const connectors = report.intros!.periods[REPORT_PERIOD_KEYS.sinceLaunch].connectors;
      const introduced = report.intros!.periods[REPORT_PERIOD_KEYS.sinceLaunch].introduced;

      expect(report.intros!.namedConnectors).toHaveLength(5);
      expect(connectors.named.reduce((total, { introduced: count }) => total + count, 0) + connectors.others.introduced).toBe(introduced);
      expect(report.intros!.namedConnectors.filter(({ name }) => name === "Same Name")).toHaveLength(2);
      expect(renderPartnerReportCsv(report).match(/Top connectors,Same Name,4,0,4/g)).toHaveLength(2);
    });

    it("keeps credit off until a member turns it on", async () => {
      expect(await readReportCredit(database, quiet.userId)).toBe(false);
      expect(await readReportCredit(database, credited.userId)).toBe(true);
    });

    it("quotes a name that looks like a spreadsheet formula", async () => {
      await nameMember(database, credited.userId, "=HYPERLINK(1)");

      expect(renderPartnerReportCsv(await readPartnerReport(database))).toContain(`Top connectors,"'=HYPERLINK(1)",2,0,2`);
    });

    it("is for admins only", async () => {
      expect((await call(postCsv, asker, {})).status).toBe(FORBIDDEN_STATUS);
      expect((await call(postPreview, asker, { note: "" })).status).toBe(FORBIDDEN_STATUS);
      expect((await call(postSend, asker, { recipients: "a@example.com", note: "" })).status).toBe(FORBIDDEN_STATUS);
    });
  });

  describe("send to partners", () => {
    function turnEmailOn() {
      vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
      vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.com>");
      vi.stubEnv("RESEND_API_URL", "http://127.0.0.1:9");
    }

    it("queues one email per address through the outbox and remembers the addresses", async () => {
      turnEmailOn();
      await database.insert(emailSuppression).values({ email: "bounced@example.com", reason: "bounced" });

      const response = await call(postSend, admin, { recipients: "one@example.com, Two@Example.com\none@example.com; bounced@example.com", note: "Our quarter." });

      expect(response.status).toBe(OK_STATUS);
      expect(await response.json()).toEqual({ queued: 2, skipped: ["bounced@example.com"] });
      const queued = await database.select().from(emailOutbox);
      expect(queued.map(({ toEmail }) => toEmail).toSorted()).toEqual(["one@example.com", "two@example.com"]);
      for (const email of queued) {
        expect(email.kind).toBe(EMAIL_KINDS.partnerReport);
        expect(email.html).toContain("Our quarter.");
        expect(email.text).not.toContain(ASKER_NAME);
        expect(email.text).not.toContain(TARGET_NAME);
      }
      expect((await readPartnerReportSettings(database)).recipients).toEqual(["one@example.com", "two@example.com", "bounced@example.com"]);
      const [entry] = await database.select().from(adminAuditEntry).where(eq(adminAuditEntry.action, AUDIT_ACTIONS.partnerReportSent));
      expect(entry?.detail).toBe("2 addresses");
    });

    it("finishes the last setup step", async () => {
      turnEmailOn();
      const before = await readSetupProgress(database);
      expect(before.steps.at(-1)).toEqual({ id: SETUP_STEPS.report, isDone: false });

      await call(postSend, admin, { recipients: "one@example.com", note: "" });

      expect((await readSetupProgress(database)).steps.at(-1)).toEqual({ id: SETUP_STEPS.report, isDone: true });
    });

    it("can be marked shared another way, for a site with no email", async () => {
      expect((await call(postShared, admin, {})).status).toBe(OK_STATUS);

      expect((await readSetupProgress(database)).steps.at(-1)).toEqual({ id: SETUP_STEPS.report, isDone: true });
    });

    it("refuses more than 20 addresses, or none", async () => {
      turnEmailOn();
      const many = Array.from({ length: 21 }, (_, index) => `p${index}@example.com`).join(",");

      expect((await call(postSend, admin, { recipients: many, note: "" })).status).toBe(UNPROCESSABLE_STATUS);
      expect((await call(postSend, admin, { recipients: " ,, ", note: "" })).status).toBe(UNPROCESSABLE_STATUS);
      expect((await call(postSend, admin, { recipients: "not-an-address", note: "" })).status).toBe(UNPROCESSABLE_STATUS);
      expect(await database.select().from(emailOutbox)).toEqual([]);
    });

    it("sends nothing when email is off", async () => {
      expect((await call(postSend, admin, { recipients: "one@example.com", note: "" })).status).toBe(CONFLICT_STATUS);
      expect(await database.select().from(emailOutbox)).toEqual([]);
    });
  });
});
