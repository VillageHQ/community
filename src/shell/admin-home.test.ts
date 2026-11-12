import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { REPORT_PERIOD_KEYS } from "@/modules/admin/contract-partner-report";
import { readPartnerReport, readReportPeriods } from "@/modules/admin/reads-partner-report";
import { INTRO_OUTCOMES, INTRO_STATES } from "@/modules/intros/contract";
import { introsManifest } from "@/modules/intros/manifest";
import { introRequest } from "@/modules/intros/schema";
import { ROUTES } from "@/platform/http/routes";
import { saveModuleState } from "@/platform/modules/enablement";
import { VILLAGE_TROUBLES } from "@/platform/village/health";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { joinMemberToGroup } from "@/test/intros";
import { createSignedInMember } from "@/test/signed-in-member";

import AdminHomePage from "@/app/(app)/admin/page";
import type { AdminTabFacts } from "./admin-badges";
import { ADMIN_HOME_ITEMS, readAdminHome, readAdminHomeItems, readConsoleHomePage, readNeedsYouItems } from "./admin-home";
import { countIntroLedger } from "./console-home";
import { describeLaunchSteps, readFirstName, LAUNCH_STEPS } from "./console-launch";
import { readIntroLog } from "@/modules/admin/reads-intro-log";

const session = vi.hoisted(() => ({ cookie: "" }));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: session.cookie }) }));

const DAY_MS = 86_400_000;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * DAY_MS);
}

const QUIET_FACTS = {
  isSetupComplete: true,
  setupStepsLeft: 0,
  membersBadge: 0,
  reportsBadge: 0,
  creditsBadge: 0,
  villageTrouble: null,
  villageOutOfCreditsAt: null,
  chatBadge: 0,
  hiddenTabHrefs: [],
} satisfies AdminTabFacts;

describe("the admin home", () => {
  const database = createTestDatabase();
  let admin: Member;
  let asker: Member;
  let connector: Member;

  async function seedIntro(seed: Partial<typeof introRequest.$inferInsert>) {
    await database.insert(introRequest).values({
      requesterId: asker.userId,
      introducerId: connector.userId,
      targetLinkedinSlug: `target-${crypto.randomUUID()}`,
      targetName: "Target Tess",
      introducerName: "Connector Cleo",
      introducerLinkedinSlug: "cleo",
      reason: "Worked together",
      note: "A note.",
      expiresAt: new Date(Date.now() + 7 * DAY_MS),
      ...seed,
    });
  }

  beforeEach(async () => {
    await clearDatabase(database);
    admin = await createSignedInMember(database, "admin");
    asker = await createSignedInMember(database);
    connector = await createSignedInMember(database);
    await joinMemberToGroup(database, asker.userId, "ada");
    await joinMemberToGroup(database, connector.userId, "cleo");
    session.cookie = admin.cookie;
  });

  afterAll(async () => {
    await database.$client.end();
  });

  it("leads with this quarter's numbers, the same as the partner report's", async () => {
    const now = new Date();
    const inQuarter = new Date(readReportPeriods(now).thisQuarter.from!.getTime() + 60_000);
    const made = { state: INTRO_STATES.completed, createdAt: inQuarter, askedTargetAt: inQuarter, targetAgreedAt: inQuarter, closedAt: inQuarter };
    await seedIntro({ ...made, outcome: INTRO_OUTCOMES.helped });
    await seedIntro({ ...made, outcome: INTRO_OUTCOMES.notHelped });
    await seedIntro({ createdAt: inQuarter });
    await seedIntro({ createdAt: inQuarter, state: INTRO_STATES.declined, closedAt: inQuarter });
    await seedIntro({ createdAt: inQuarter, isWithheld: true });
    await seedIntro({ ...made, createdAt: daysAgo(readReportPeriods(now).thisQuarter.from!, 5), outcome: INTRO_OUTCOMES.helped });

    const [{ quarter }, report] = await Promise.all([readAdminHome(database, process.env, now), readPartnerReport(database, now)]);
    const reported = report.intros?.periods[REPORT_PERIOD_KEYS.thisQuarter];

    expect(quarter).toEqual({ periodLabel: report.periods[0]?.label, asked: reported?.asked, introduced: reported?.introduced, helped: reported?.helped });
    expect(quarter).toMatchObject({ asked: 4, introduced: 2, helped: 1 });
  });

  it("says intros are off instead of showing a count", async () => {
    await saveModuleState(database, introsManifest, false);

    const { quarter, items } = await readAdminHome(database, process.env);

    expect(quarter).toBeNull();
    expect(items.map(({ id }) => id)).not.toContain(ADMIN_HOME_ITEMS.stuckIntros);
  });

  it("counts an ask as stuck only after the reminder day, at either side", async () => {
    const now = new Date();
    await seedIntro({ createdAt: daysAgo(now, 5) });
    await seedIntro({ createdAt: daysAgo(now, 9), state: INTRO_STATES.askingTarget, askedTargetAt: daysAgo(now, 6) });
    await seedIntro({ createdAt: daysAgo(now, 1) });
    await seedIntro({ createdAt: daysAgo(now, 9), state: INTRO_STATES.askingTarget, askedTargetAt: daysAgo(now, 1) });
    await seedIntro({ createdAt: daysAgo(now, 9), isWithheld: true });

    const { items } = await readAdminHome(database, process.env, now);

    expect(items.find(({ id }) => id === ADMIN_HOME_ITEMS.stuckIntros)).toEqual({
      id: ADMIN_HOME_ITEMS.stuckIntros,
      label: "2 intros asked over 4 days ago, still no answer",
      href: ROUTES.adminReport,
      isUrgent: false,
    });
  });

  it("shows the setup item on a fresh install, linking to setup", async () => {
    const { items } = await readAdminHome(database, process.env);

    expect(items.find(({ id }) => id === ADMIN_HOME_ITEMS.setup)).toMatchObject({ href: ROUTES.adminSetup });
  });

  it("links each item to its place and leaves out every item at zero", () => {
    expect(readAdminHomeItems(QUIET_FACTS, { pendingInvites: 0, stuckIntros: 0 })).toEqual([]);

    const items = readAdminHomeItems(
      { ...QUIET_FACTS, reportsBadge: 1, membersBadge: 2, setupStepsLeft: 3, villageTrouble: { trouble: VILLAGE_TROUBLES.keysRejected, troubleAt: null, lastOkAt: null } },
      { pendingInvites: 1, stuckIntros: 0 },
    );

    expect(items.map(({ label, href }) => [label, href])).toEqual([
      ["Village refused your keys", `${ROUTES.adminSettings}?step=keys`],
      ["1 report waiting", ROUTES.adminReports],
      ["2 people waiting for your OK", ROUTES.adminMembers],
      ["1 invite not accepted yet", ROUTES.adminInvites],
      ["3 setup steps left", ROUTES.adminSetup],
    ]);
  });

  it("opens the Village check from the Village item when network is on", () => {
    const facts = { ...QUIET_FACTS, villageTrouble: { trouble: VILLAGE_TROUBLES.keysRejected, troubleAt: null, lastOkAt: null } };

    expect(readAdminHomeItems(facts, { pendingInvites: 0, stuckIntros: 0, isNetworkOn: true })).toEqual([expect.objectContaining({ href: ROUTES.adminVillage })]);
  });

  it("counts every intro like Founderhall's ledger and names who asked whom, never the note", async () => {
    const now = new Date();
    await seedIntro({ state: INTRO_STATES.completed, acceptedAt: now, askedTargetAt: now, targetAgreedAt: now, closedAt: now, outcome: INTRO_OUTCOMES.helped });
    await seedIntro({ state: INTRO_STATES.askingTarget, askedTargetAt: now });
    await seedIntro({});
    await seedIntro({ state: INTRO_STATES.declined, closedAt: now });
    await seedIntro({ state: INTRO_STATES.targetDeclined, askedTargetAt: now, closedAt: now });
    await seedIntro({ state: INTRO_STATES.withdrawn, closedAt: now });
    await seedIntro({ state: INTRO_STATES.expired, closedAt: now });
    await seedIntro({ isWithheld: true });

    const log = await readIntroLog(database);

    // A no-answer expiry is its own line, never a decline (ADM-04).
    expect(countIntroLedger(log)).toEqual({
      asked: 6,
      connectorYes: 3,
      made: 1,
      declinedByConnector: 1,
      declinedByTarget: 1,
      declined: 2,
      noAnswer: 1,
      openWithConnector: 1,
      openWithTarget: 1,
      open: 2,
      answered: 1,
      helpful: 1,
    });
    expect(JSON.stringify(log)).toMatch(/Target Tess/);
    expect(JSON.stringify(log)).not.toContain("A note.");
  });

  it("opens on the launch checklist on a fresh install, and on the dashboard once all four steps are done", async () => {
    const fresh = await readConsoleHomePage(database, process.env);

    expect(fresh.isLaunched).toBe(false);
    expect(fresh.home).toBeNull();
    expect(fresh.steps.map(({ key, isDone }) => [key, isDone])).toEqual([
      [LAUNCH_STEPS.look, false],
      [LAUNCH_STEPS.invite, false],
      [LAUNCH_STEPS.plumbing, false],
      [LAUNCH_STEPS.report, false],
    ]);
  });

  it("words each launch step like Founderhall, with its link", () => {
    const facts = { communityName: "Harbor Ventures", isLookSet: false, hasLogo: false, invitesSent: 2, isMailSet: false, isNetworkSet: false, mailDomain: null, hasMadeIntro: false };
    const text = describeLaunchSteps(facts).map(({ text: parts }) => parts.map(({ text: words }) => words).join(""));

    expect(text).toEqual([
      "Your fund’s name, colour and logo on every page and email. Set your look →",
      "2 invites sent. Invite more →",
      "Set up mail so invites and digests are emailed. Connect Village so founders can connect their networks and search finds warm paths.",
      "Appears here the day the first intro is counted. You can send it to partners as a PDF.",
    ]);
    expect(describeLaunchSteps({ ...facts, isLookSet: true, hasLogo: true, isMailSet: true, isNetworkSet: true, mailDomain: "mail.harbor.example", hasMadeIntro: true }).map(({ isDone }) => isDone)).toEqual([true, true, true, true]);
    expect(readFirstName("Dana Whitfield", "x@example.com")).toBe("Dana");
    expect(readFirstName("", "dana.whitfield@example.com")).toBe("Dana");
  });

  it("leaves invites and setup out of Home's note: they have their own places there", () => {
    const items = readAdminHomeItems({ ...QUIET_FACTS, reportsBadge: 1, setupStepsLeft: 2 }, { pendingInvites: 3, stuckIntros: 0 });

    expect(readNeedsYouItems(items).map(({ id }) => id)).toEqual([ADMIN_HOME_ITEMS.reports]);
  });

  it("sends a member who isn't an admin away", async () => {
    session.cookie = asker.cookie;

    await expect(AdminHomePage()).rejects.toThrow(/NEXT_REDIRECT/);
  });
});
