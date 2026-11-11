import { count, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ask } from "@/modules/asks/schema";
import { introRequest } from "@/modules/intros/schema";
import { PUBLIC_BOARD_SETTING } from "@/modules/job-board/contract";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { jobPosting, jobSource } from "@/modules/job-board/schema";
import { DEMO_PULL_NOTE, pullDueSources, pullSource } from "@/modules/job-board/service-pull";
import { chatManifest } from "@/modules/chat/manifest";
import { feedManifest } from "@/modules/feed/manifest";
import { perksManifest } from "@/modules/perks/manifest";
import { INTRO_STATES } from "@/modules/intros/contract";
import { invite, memberProfile } from "@/modules/members/schema";
import { session, user } from "@/platform/database/auth-schema";
import { DEMO_REFUSAL_MESSAGE } from "@/platform/demo/guard";
import { DEMO_ACCOUNTS, DEMO_EMAIL_NOTE } from "@/platform/demo/mode";
import { createDemoFetch, DEMO_OUTSIDE_CALL_MESSAGE } from "@/platform/demo/outbound";
import { DEMO_JOB_SOURCES } from "@/platform/demo/jobs";
import { DEMO_DATA_HOME, DEMO_PEOPLE } from "@/platform/demo/people";
import { readEnabledModuleIds } from "@/platform/modules/enablement";
import { readSettings } from "@/platform/settings/store";
import { readDataHome } from "@/platform/settings/data-home";
import { sendDueEmails, sendQueuedEmailNow } from "@/platform/email/outbox-sender";
import { queueEmail } from "@/platform/email/outbox";
import { emailOutbox } from "@/platform/email/schema";
import { EMAIL_KINDS } from "@/platform/email/kinds";
import { clearDatabase, createTestDatabase } from "@/test/database";

import { DEMO_RESET_JOB_NAME, readLastResetBoundary, resetDemo, runNightlyDemoReset, startDemo } from "./demo-reset";
import { readScheduledJobs } from "./scheduled-jobs";

const APP_URL = "http://localhost:3000";
const DEMO_ENVIRONMENT = { DEMO_MODE: "true", APP_URL };

describe("demo mode", () => {
  const database = createTestDatabase();
  let route: typeof import("@/app/api/demo/sign-in/route");

  function postDemoSignIn(who: string) {
    const body = new URLSearchParams({ who });
    return route.POST(
      new Request(`${APP_URL}/api/demo/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: APP_URL },
        body,
      }),
    );
  }

  async function countRows(table: typeof user | typeof introRequest | typeof ask | typeof invite | typeof jobSource | typeof jobPosting) {
    const [row] = await database.select({ total: count() }).from(table);
    return row?.total ?? 0;
  }

  async function emptyEverything() {
    await clearDatabase(database);
    await database.execute(sql`truncate table "user" cascade`);
  }

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-with-at-least-32-characters");
    route = await import("@/app/api/demo/sign-in/route");
  });

  beforeEach(async () => {
    await emptyEverything();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-with-at-least-32-characters");
  });

  afterAll(async () => {
    await emptyEverything();
    await database.$client.end();
  });

  describe("with the switch off", () => {
    it("has no demo sign-in, no reset job, and never seeds", async () => {
      expect((await postDemoSignIn("member")).status).toBe(404);
      expect((await readScheduledJobs(database)).map(({ name }) => name)).not.toContain(DEMO_RESET_JOB_NAME);
      expect(await startDemo(database, { APP_URL })).toEqual({ outcome: "off" });
      await expect(resetDemo(database, { APP_URL })).rejects.toThrow("DEMO_MODE=true");
      expect(await countRows(user)).toBe(0);
    });
  });

  // The job board (public board on) and perks are on with made-up content; the feed and Slack/Discord stay off.
  async function expectJobsAndPerks() {
    const enabled = await readEnabledModuleIds(database, [jobBoardManifest, perksManifest, feedManifest, chatManifest]);
    expect([...enabled].sort()).toEqual([jobBoardManifest.id, perksManifest.id].sort());
    expect((await readSettings(database, [PUBLIC_BOARD_SETTING])).get(PUBLIC_BOARD_SETTING)).toBe("on");
    expect(await countRows(jobSource)).toBe(DEMO_JOB_SOURCES.length);
    expect(await countRows(jobPosting)).toBe(DEMO_JOB_SOURCES.reduce((total, source) => total + source.jobs.length, 0));
    const links = await database.select({ url: jobSource.sourceUrl, error: jobSource.lastError }).from(jobSource);
    expect(links.every(({ url, error }) => url?.startsWith("https://") && new URL(url).hostname.endsWith(".example.com") && error === null)).toBe(true);
  }

  describe("with the switch on", () => {
    beforeEach(() => {
      vi.stubEnv("DEMO_MODE", "true");
    });

    it("seeds an empty database with a whole made-up community", async () => {
      expect(await startDemo(database, DEMO_ENVIRONMENT)).toEqual({ outcome: "seeded" });

      const members = await database.select({ email: user.email }).from(user);
      expect(members.length).toBe(DEMO_PEOPLE.length);
      expect(members.length).toBeGreaterThanOrEqual(18);
      expect(members.every(({ email }) => email.endsWith("@example.com"))).toBe(true);
      const states = new Set((await database.select({ state: introRequest.state }).from(introRequest)).map(({ state }) => state));
      expect([...states].sort()).toEqual(Object.values(INTRO_STATES).sort());
      expect(await countRows(ask)).toBeGreaterThan(5);
      expect(await countRows(invite)).toBeGreaterThan(0);
      expect(await readDataHome(database)).toEqual({ location: DEMO_DATA_HOME.location, contact: { name: DEMO_DATA_HOME.contactName, email: DEMO_DATA_HOME.contactEmail } });
      expect(DEMO_DATA_HOME.contactEmail.endsWith("@example.com")).toBe(true);
      await expectJobsAndPerks();
      expect(await startDemo(database, DEMO_ENVIRONMENT)).toEqual({ outcome: "ready" });
      expect((await readScheduledJobs(database)).map(({ name }) => name)).toContain(DEMO_RESET_JOB_NAME);
    });

    it("signs in as the member and as the admin with one click", async () => {
      await startDemo(database, DEMO_ENVIRONMENT);

      for (const who of ["member", "admin"] as const) {
        const response = await postDemoSignIn(who);
        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toBe("/");
        expect(response.headers.getSetCookie().join(";")).toContain("session_token");
        const [member] = await database.select({ id: user.id, role: user.role }).from(user).where(eq(user.email, DEMO_ACCOUNTS[who].email));
        expect(member?.role).toBe(who === "admin" ? "admin" : "user");
        const sessions = await database.select({ id: session.id }).from(session).where(eq(session.userId, member?.id ?? ""));
        expect(sessions.length).toBe(1);
      }
      expect((await postDemoSignIn("someone-else")).headers.get("location")).toBe("/signin?demo=unknown");
    });

    it("restores the seed at the nightly reset, after edits", async () => {
      const seededAt = new Date("2026-11-09T12:00:00.000Z");
      await resetDemo(database, DEMO_ENVIRONMENT, seededAt);
      await database.delete(ask);
      await database.delete(jobSource);
      await database.update(memberProfile).set({ title: "Edited by a visitor" });
      await database.update(user).set({ name: "Renamed" }).where(eq(user.email, DEMO_ACCOUNTS.member.email));

      // Before 04:00 the next day nothing happens; after it, the reset runs once.
      expect(await runNightlyDemoReset(database, DEMO_ENVIRONMENT, new Date("2026-11-10T03:30:00.000Z"))).toEqual({ isReset: false });
      expect(await runNightlyDemoReset(database, DEMO_ENVIRONMENT, new Date("2026-11-10T04:05:00.000Z"))).toEqual({ isReset: true });
      expect(await runNightlyDemoReset(database, DEMO_ENVIRONMENT, new Date("2026-11-10T09:00:00.000Z"))).toEqual({ isReset: false });

      expect(await countRows(ask)).toBeGreaterThan(5);
      const [sam] = await database.select({ name: user.name }).from(user).where(eq(user.email, DEMO_ACCOUNTS.member.email));
      expect(sam?.name).toBe("Sam Lee");
      const edited = await database.select({ title: memberProfile.title }).from(memberProfile).where(eq(memberProfile.title, "Edited by a visitor"));
      expect(edited).toEqual([]);
      expect(await countRows(user)).toBe(DEMO_PEOPLE.length);
      await expectJobsAndPerks();
    });

    it("never fetches a job feed: the pull skips, keeps the seeded jobs and shows no problem", async () => {
      await startDemo(database, DEMO_ENVIRONMENT);
      const jobsBefore = await countRows(jobPosting);
      await database.update(jobSource).set({ lastPulledAt: null });
      const fetchSpy = vi.fn(async () => new Response("[]"));

      expect(await pullDueSources(database, DEMO_ENVIRONMENT, { fetch: fetchSpy })).toEqual({ pulled: 0, failed: 0 });
      const [source] = await database.select().from(jobSource).limit(1);
      if (!source) throw new Error("The demo seeded no job source.");
      expect(await pullSource(database, DEMO_ENVIRONMENT, source, { fetch: fetchSpy })).toEqual({ ok: true, count: 0, note: DEMO_PULL_NOTE });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(await countRows(jobPosting)).toBe(jobsBefore);
      const problems = await database.select({ error: jobSource.lastError }).from(jobSource);
      expect(problems.every(({ error }) => error === null)).toBe(true);
    });

    it("refuses a database with real members, in plain words, and never resets it", async () => {
      await database.insert(user).values({ id: "real-1", name: "Real Person", email: "real.person@fund.com", emailVerified: true, role: "admin" });

      expect(await startDemo(database, DEMO_ENVIRONMENT)).toEqual({ outcome: "refused", message: DEMO_REFUSAL_MESSAGE });
      expect(DEMO_REFUSAL_MESSAGE).toContain("holds real members");
      await expect(resetDemo(database, DEMO_ENVIRONMENT)).rejects.toThrow(DEMO_REFUSAL_MESSAGE);
      expect((await postDemoSignIn("member")).headers.get("location")).toBe("/signin?demo=missing");
      expect(await countRows(user)).toBe(1);
    });

    it("refuses a database of example.com members the demo didn't seed", async () => {
      await database.insert(user).values({ id: "test-1", name: "Test Person", email: "test@example.com", emailVerified: true });
      expect((await startDemo(database, DEMO_ENVIRONMENT)).outcome).toBe("refused");
    });

    it("keeps every email in the sending log and sends none", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      await queueEmail(database, DEMO_ENVIRONMENT, { kind: EMAIL_KINDS.invite, to: "sofia.mensah@example.com", memberId: null, subject: "Join", html: "<p>Join</p>", text: "Join" });

      await sendDueEmails(database, DEMO_ENVIRONMENT);

      const [logged] = await database.select({ status: emailOutbox.status, lastError: emailOutbox.lastError }).from(emailOutbox);
      await database.delete(emailOutbox);
      expect(logged).toEqual({ status: "skipped", lastError: DEMO_EMAIL_NOTE });
      // Sent at once (an invite, a test email): handled, so no screen says it's retrying.
      const queuedId = await queueEmail(database, DEMO_ENVIRONMENT, { kind: EMAIL_KINDS.invite, to: "ruby.haas@example.com", memberId: null, subject: "Join", html: "<p>Join</p>", text: "Join" });
      expect(await sendQueuedEmailNow(database, DEMO_ENVIRONMENT, queuedId)).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe("the outside-call guard", () => {
    const original = vi.fn(async () => new Response("local"));
    const guarded = createDemoFetch(original, DEMO_ENVIRONMENT);

    it("refuses every outside service before connecting", async () => {
      for (const url of ["https://api.resend.com/emails", "https://slack.com/api/chat.postMessage", "https://discord.com/api/v10/channels/1/messages", "https://boards-api.greenhouse.io/v1/boards/x/jobs", "https://api.village.ai/v2/app"]) {
        await expect(guarded(url, { method: "POST" })).rejects.toThrow(DEMO_OUTSIDE_CALL_MESSAGE);
      }
      expect(original).not.toHaveBeenCalled();
    });

    it("lets the app call itself", async () => {
      expect(await (await guarded("http://127.0.0.1:3000/api/jobs/tick", { method: "POST" })).text()).toBe("local");
    });

    it("answers Village with canned made-up results", async () => {
      const tokenResponse = await guarded("https://village.demo.invalid/v2/auth/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ external_user_id: "member-1", email: DEMO_ACCOUNTS.member.email }),
      });
      const { data } = (await tokenResponse.json()) as { data: { token: string } };
      const searchResponse = await guarded("https://village.demo.invalid/v2/people/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "hospital procurement" }),
      });
      const search = (await searchResponse.json()) as { data: { full_name: string; linkedin_url: string }[] };
      // The story Founderhall's demo tells: two people Sam knows first-hand, and Rosa through Marcus.
      expect(search.data.map(({ full_name }) => full_name)).toEqual(["Alex Kim", "Dana Morris", "Rosa Lindqvist"]);
      const pathsResponse = await guarded("https://village.demo.invalid/v2/people/paths", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_url: search.data[2]?.linkedin_url }),
      });
      const paths = (await pathsResponse.json()) as { data: { paths: { introducer: { profile: { linkedin_url: string } } }[] } };
      expect(paths.data.paths[0]?.introducer.profile.linkedin_url).toContain("-northwind-demo");
      expect(original).not.toHaveBeenCalled();
    });
  });

  it("resets at 04:00 UTC", () => {
    expect(readLastResetBoundary(new Date("2026-11-10T03:59:00.000Z")).toISOString()).toBe("2026-11-09T04:00:00.000Z");
    expect(readLastResetBoundary(new Date("2026-11-10T04:00:00.000Z")).toISOString()).toBe("2026-11-10T04:00:00.000Z");
  });
});
