import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as postCsv } from "@/app/api/admin/intro-log/csv/route";
import { POST as postOutcomeDays } from "@/app/api/admin/intro-log/outcome-days/route";
import { renderIntroLogCsv } from "@/modules/admin/intro-log-csv";
import { countIntroLog, readIntroLog } from "@/modules/admin/reads-intro-log";
import { INTRO_OUTCOMES, INTRO_STATES } from "@/modules/intros/contract";
import { OUTCOME_DAYS_SETTING } from "@/modules/intros/contract-outcome-days";
import { readIntroCounts } from "@/modules/intros/reads";
import { readOutcomeDays } from "@/modules/intros/reads-outcome-days";
import { introRequest } from "@/modules/intros/schema";
import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { adminAuditEntry } from "@/platform/audit/schema";
import { instanceSettings } from "@/platform/settings/schema";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { joinMemberToGroup, nameMember } from "@/test/intros";
import { createSignedInMember } from "@/test/signed-in-member";

const APP_URL = "http://localhost:3000";
const DAY_MS = 86_400_000;
const ASKER_NAME = "Asker Ada";
const CONNECTOR_NAME = "Connector Cole";
const TARGET_NAME = "Target Tess";
const NOTE = "A private note about freight pricing.";
const REASON = "Worked together at Northpoint";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;

function call(handler: (request: Request) => Promise<Response>, member: Member, body: unknown) {
  return handler(
    new Request(`${APP_URL}/api/admin/intro-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
      body: JSON.stringify(body),
    }),
  );
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY_MS);
}

describe("the console's intro log", () => {
  const database = createTestDatabase();
  let admin: Member;
  let asker: Member;
  let connector: Member;

  async function seedIntro(seed: Partial<typeof introRequest.$inferInsert>) {
    const [row] = await database
      .insert(introRequest)
      .values({
        requesterId: asker.userId,
        introducerId: connector.userId,
        targetLinkedinSlug: `target-${crypto.randomUUID()}`,
        targetName: TARGET_NAME,
        targetHeadline: "VP Sales at Countwise",
        introducerName: CONNECTOR_NAME,
        introducerLinkedinSlug: "cole",
        reason: REASON,
        note: NOTE,
        expiresAt: new Date(Date.now() + 7 * DAY_MS),
        ...seed,
      })
      .returning({ id: introRequest.id });
    return row!.id;
  }

  beforeEach(async () => {
    await clearDatabase(database);
    admin = await createSignedInMember(database, "admin");
    asker = await createSignedInMember(database);
    connector = await createSignedInMember(database);
    await nameMember(database, asker.userId, ASKER_NAME);
    await nameMember(database, connector.userId, CONNECTOR_NAME);
    await joinMemberToGroup(database, asker.userId, "ada");
    await joinMemberToGroup(database, connector.userId, "cole");
  });

  afterAll(async () => {
    await clearDatabase(database);
  });

  it("shows who asked whom, states and dates, and never the note or reason", async () => {
    const asked = daysAgo(3);
    await seedIntro({ createdAt: asked });
    await seedIntro({ createdAt: asked, state: INTRO_STATES.askingTarget, acceptedAt: daysAgo(2), askedTargetAt: daysAgo(2) });
    await seedIntro({ createdAt: asked, state: INTRO_STATES.completed, askedTargetAt: daysAgo(2), targetAgreedAt: daysAgo(1), closedAt: daysAgo(1), outcome: INTRO_OUTCOMES.helped });
    await seedIntro({ createdAt: asked, state: INTRO_STATES.declined, closedAt: daysAgo(2) });
    await seedIntro({ createdAt: asked, state: INTRO_STATES.withdrawn, closedAt: daysAgo(2) });
    await seedIntro({ createdAt: asked, isWithheld: true });

    const rows = await readIntroLog(database);
    expect(rows.map(({ stateWord }) => stateWord).toSorted()).toEqual(["declined by connector", "introduced", "with connector", "with target", "withdrawn"]);
    expect(countIntroLog(rows)).toEqual({ all: 5, open: 2, made: 1, declined: 1, withdrawn: 1 });
    const made = rows.find(({ stateWord }) => stateWord === "introduced")!;
    expect(made).toMatchObject({ outcome: INTRO_OUTCOMES.helped, tone: "made" });
    expect(made.introducedAt).not.toBeNull();

    for (const text of [JSON.stringify(rows), renderIntroLogCsv(rows)]) {
      for (const name of [ASKER_NAME, CONNECTOR_NAME, TARGET_NAME, "Countwise"]) expect(text).toContain(name);
      for (const secret of [NOTE, REASON]) expect(text).not.toContain(secret);
    }

    const response = await call(postCsv, admin, { period: "all" });
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv.split("\r\n")[0]).toBe("asked_at,asker,target,target_company,connector,state,answered_at,introduced_at,outcome");
    expect(csv).toContain(`${ASKER_NAME},${TARGET_NAME},Countwise,${CONNECTOR_NAME}`);
    expect(csv).not.toContain(NOTE);
  });

  it("keeps the CSV and the outcome setting to admins", async () => {
    expect((await call(postCsv, asker, { period: "quarter" })).status).toBe(403);
    expect((await call(postOutcomeDays, asker, { outcomeDays: 30 })).status).toBe(403);
  });

  it("asks the outcome question the saved number of days after an intro", async () => {
    expect(await readOutcomeDays(database)).toBe(14);
    await seedIntro({ createdAt: daysAgo(30), state: INTRO_STATES.completed, askedTargetAt: daysAgo(29), targetAgreedAt: daysAgo(28), closedAt: daysAgo(10) });
    expect((await readIntroCounts(database, asker.userId)).outcomesDue).toBe(0);

    const response = await call(postOutcomeDays, admin, { outcomeDays: 7 });
    expect(response.status).toBe(200);
    expect(await readOutcomeDays(database)).toBe(7);
    expect((await readIntroCounts(database, asker.userId)).outcomesDue).toBe(1);
    const [entry] = await database.select().from(adminAuditEntry).where(eq(adminAuditEntry.action, AUDIT_ACTIONS.introOutcomeDaysChanged));
    expect(entry?.detail).toBe("7");

    expect((await call(postOutcomeDays, admin, { outcomeDays: 0 })).status).toBe(422);
    expect((await call(postOutcomeDays, admin, { outcomeDays: 91 })).status).toBe(422);
    const [stored] = await database.select().from(instanceSettings).where(eq(instanceSettings.key, OUTCOME_DAYS_SETTING));
    expect(stored?.value).toBe("7");
  });
});
